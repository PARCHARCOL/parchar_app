```javascript
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

// NOTA:
// Ajuste realizado para compatibilidad con Render/Linux.
// Corrige la carga de CSS, JS, imágenes y assets desde /public.

function readPublicPath(urlPathname) {
  let safePath = urlPathname;

  // Si la ruta es "/", cargar index.html
  if (safePath === "/") {
    safePath = "/index.html";
  }

  // Elimina slashes iniciales para evitar problemas de rutas en Linux
  safePath = safePath.replace(/^\/+/, "");

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
      const publicPath = readPublicPath(pathname);
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
```
