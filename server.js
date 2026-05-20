const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");
const { randomBytes, scryptSync } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const PORT = Number(process.env.PORT || 8080);
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const configuredUploadsDir = process.env.UPLOADS_DIR || "uploads";
const configuredDataDir = process.env.DATA_DIR || "data";
const UPLOADS_DIR = path.isAbsolute(configuredUploadsDir)
  ? configuredUploadsDir
  : path.join(ROOT_DIR, configuredUploadsDir);
const DATA_DIR = path.isAbsolute(configuredDataDir)
  ? configuredDataDir
  : path.join(ROOT_DIR, configuredDataDir);
const DB_PATH = path.join(DATA_DIR, "parchar.db");
const ALLOWED_CATEGORIES = new Set(["moto", "carro", "romantico", "bbb"]);

for (const dir of [PUBLIC_DIR, UPLOADS_DIR, DATA_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    age INTEGER NOT NULL,
    city TEXT NOT NULL,
    neighborhood TEXT NOT NULL,
    preferences TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS businesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_name TEXT NOT NULL,
    owner_email TEXT NOT NULL,
    owner_phone TEXT NOT NULL,
    business_name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    products TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    video_path TEXT NOT NULL,
    video_seconds REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const insertUserStmt = db.prepare(`
  INSERT INTO users (
    full_name, email, phone, password_hash, age, city, neighborhood, preferences
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertBusinessStmt = db.prepare(`
  INSERT INTO businesses (
    owner_name, owner_email, owner_phone, business_name, category, description,
    products, address, city, latitude, longitude, video_path, video_seconds
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const selectBusinessesStmt = db.prepare(`
  SELECT
    id,
    owner_name AS ownerName,
    owner_email AS ownerEmail,
    owner_phone AS ownerPhone,
    business_name AS businessName,
    category,
    description,
    products,
    address,
    city,
    latitude,
    longitude,
    video_path AS videoPath,
    video_seconds AS videoSeconds,
    created_at AS createdAt
  FROM businesses
  WHERE (? = '' OR category = ?)
  ORDER BY created_at DESC
`);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
};

function normalizeCategory(rawValue) {
  return String(rawValue || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function cleanText(value) {
  return String(value || "").trim();
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendFile(res, absolutePath) {
  if (!fs.existsSync(absolutePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const ext = path.extname(absolutePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const stream = fs.createReadStream(absolutePath);
  res.writeHead(200, { "Content-Type": contentType });
  stream.pipe(res);
}

function safeUploadName(baseName, ext) {
  return `${Date.now()}-${baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}${ext}`;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function parseJsonBody(req) {
  const webRequest = new Request("http://localhost", {
    method: req.method,
    headers: req.headers,
    body: req,
    duplex: "half",
  });
  return webRequest.json();
}

async function parseMultipartForm(req, url) {
  const webRequest = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: req,
    duplex: "half",
  });
  return webRequest.formData();
}

function validateLatitude(value) {
  const lat = Number(value);
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 ? lat : null;
}

function validateLongitude(value) {
  const lon = Number(value);
  return Number.isFinite(lon) && lon >= -180 && lon <= 180 ? lon : null;
}

function readPublicPath(urlPathname) {
  const normalized = path.normalize(urlPathname).replace(/^(\.\.[\\/])+/, "");
  const safePath = normalized === path.sep ? "index.html" : normalized;
  return path.join(PUBLIC_DIR, safePath);
}

const server = http.createServer(async (req, res) => {
  try {
    const host = req.headers.host || `localhost:${PORT}`;
    const requestUrl = new URL(req.url || "/", `http://${host}`);
    const pathname = requestUrl.pathname;

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      });
      res.end();
      return;
    }

    if (pathname === "/api/health" && req.method === "GET") {
      sendJson(res, 200, { ok: true, app: "parchar" });
      return;
    }

    if (pathname === "/api/users/register" && req.method === "POST") {
      const body = await parseJsonBody(req);
      const fullName = cleanText(body.fullName);
      const email = cleanText(body.email).toLowerCase();
      const phone = cleanText(body.phone);
      const password = cleanText(body.password);
      const age = Number(body.age);
      const city = cleanText(body.city);
      const neighborhood = cleanText(body.neighborhood);
      const preferences = cleanText(body.preferences);

      if (
        !fullName ||
        !email ||
        !phone ||
        !password ||
        !Number.isFinite(age) ||
        age < 14 ||
        !city ||
        !neighborhood ||
        !preferences
      ) {
        sendJson(res, 400, {
          error:
            "Completa todos los campos del usuario (nombre, correo, telefono, contrasena, edad, ciudad, barrio y preferencias).",
        });
        return;
      }

      if (!email.includes("@")) {
        sendJson(res, 400, { error: "El correo no parece valido." });
        return;
      }

      if (password.length < 6) {
        sendJson(res, 400, {
          error: "La contrasena debe tener al menos 6 caracteres.",
        });
        return;
      }

      try {
        insertUserStmt.run(
          fullName,
          email,
          phone,
          hashPassword(password),
          age,
          city,
          neighborhood,
          preferences
        );
      } catch (error) {
        if (String(error.message).includes("UNIQUE")) {
          sendJson(res, 409, { error: "Ese correo ya esta registrado." });
          return;
        }
        throw error;
      }

      sendJson(res, 201, { message: "Usuario creado correctamente." });
      return;
    }

    if (pathname === "/api/businesses/register" && req.method === "POST") {
      const formData = await parseMultipartForm(req, requestUrl.toString());
      const ownerName = cleanText(formData.get("ownerName"));
      const ownerEmail = cleanText(formData.get("ownerEmail")).toLowerCase();
      const ownerPhone = cleanText(formData.get("ownerPhone"));
      const businessName = cleanText(formData.get("businessName"));
      const category = normalizeCategory(formData.get("category"));
      const description = cleanText(formData.get("description"));
      const products = cleanText(formData.get("products"));
      const address = cleanText(formData.get("address"));
      const city = cleanText(formData.get("city"));
      const latitude = validateLatitude(formData.get("latitude"));
      const longitude = validateLongitude(formData.get("longitude"));
      const videoDurationSeconds = Number(formData.get("videoDurationSeconds"));
      const videoFile = formData.get("video");

      if (
        !ownerName ||
        !ownerEmail ||
        !ownerPhone ||
        !businessName ||
        !category ||
        !description ||
        !products ||
        !address ||
        !city
      ) {
        sendJson(res, 400, {
          error: "Completa todos los campos del registro de negocio.",
        });
        return;
      }

      if (!ALLOWED_CATEGORIES.has(category)) {
        sendJson(res, 400, {
          error:
            "Categoria invalida. Usa moto, carro, romantico o bbb.",
        });
        return;
      }

      if (latitude === null || longitude === null) {
        sendJson(res, 400, {
          error: "Debes enviar una ubicacion valida (latitud y longitud).",
        });
        return;
      }

      if (
        !Number.isFinite(videoDurationSeconds) ||
        videoDurationSeconds < 10 ||
        videoDurationSeconds > 13
      ) {
        sendJson(res, 400, {
          error:
            "El video debe durar minimo 10 segundos y maximo 13 segundos.",
        });
        return;
      }

      if (!(videoFile instanceof File) || videoFile.size === 0) {
        sendJson(res, 400, {
          error: "Debes subir un video del local para publicar el negocio.",
        });
        return;
      }

      const maxSizeBytes = 50 * 1024 * 1024;
      if (videoFile.size > maxSizeBytes) {
        sendJson(res, 400, {
          error: "El video supera el maximo permitido de 50 MB.",
        });
        return;
      }

      const allowedMime = new Set([
        "video/mp4",
        "video/webm",
        "video/quicktime",
      ]);
      if (!allowedMime.has(videoFile.type)) {
        sendJson(res, 400, {
          error: "Formato no permitido. Usa MP4, WEBM o MOV.",
        });
        return;
      }

      const ext = path.extname(videoFile.name || "").toLowerCase() || ".mp4";
      const safeName = safeUploadName(businessName, ext);
      const absoluteVideoPath = path.join(UPLOADS_DIR, safeName);
      const videoBytes = Buffer.from(await videoFile.arrayBuffer());
      fs.writeFileSync(absoluteVideoPath, videoBytes);

      insertBusinessStmt.run(
        ownerName,
        ownerEmail,
        ownerPhone,
        businessName,
        category,
        description,
        products,
        address,
        city,
        latitude,
        longitude,
        `/uploads/${safeName}`,
        Number(videoDurationSeconds.toFixed(2))
      );

      sendJson(res, 201, {
        message: "Negocio registrado. Ya aparece en Parchar.",
      });
      return;
    }

    if (pathname === "/api/businesses" && req.method === "GET") {
      const category = normalizeCategory(requestUrl.searchParams.get("category"));
      const userLat = Number(requestUrl.searchParams.get("lat"));
      const userLon = Number(requestUrl.searchParams.get("lng"));
      const radiusKm = Number(requestUrl.searchParams.get("radiusKm") || "80");
      const hasUserPosition = Number.isFinite(userLat) && Number.isFinite(userLon);

      const rows = selectBusinessesStmt.all(
        ALLOWED_CATEGORIES.has(category) ? category : "",
        ALLOWED_CATEGORIES.has(category) ? category : ""
      );

      const withDistance = rows
        .map((row) => {
          if (!hasUserPosition) {
            return { ...row, distanceKm: null, videoUrl: row.videoPath };
          }

          const distanceKm = haversineKm(
            userLat,
            userLon,
            Number(row.latitude),
            Number(row.longitude)
          );
          return {
            ...row,
            distanceKm: Number(distanceKm.toFixed(2)),
            videoUrl: row.videoPath,
          };
        })
        .filter((row) => {
          if (!hasUserPosition) return true;
          return row.distanceKm <= radiusKm;
        })
        .sort((a, b) => {
          if (a.distanceKm === null && b.distanceKm === null) return 0;
          if (a.distanceKm === null) return 1;
          if (b.distanceKm === null) return -1;
          return a.distanceKm - b.distanceKm;
        });

      sendJson(res, 200, { items: withDistance });
      return;
    }

    if (pathname.startsWith("/uploads/")) {
      const relative = pathname.replace(/^\/uploads\//, "");
      const absolutePath = path.join(UPLOADS_DIR, relative);
      if (!absolutePath.startsWith(UPLOADS_DIR)) {
        sendJson(res, 403, { error: "Acceso no permitido." });
        return;
      }
      sendFile(res, absolutePath);
      return;
    }

    if (req.method === "GET") {
      const publicPath =
        pathname === "/"
          ? path.join(PUBLIC_DIR, "index.html")
          : readPublicPath(pathname);
      sendFile(res, publicPath);
      return;
    }

    sendJson(res, 404, { error: "Ruta no encontrada." });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Error interno del servidor." });
  }
});

server.listen(PORT, () => {
  console.log(`Parchar listo en http://localhost:${PORT}`);
});
