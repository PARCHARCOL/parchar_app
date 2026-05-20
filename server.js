
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");
const { randomBytes, scryptSync } = require("node:crypto");
const { Pool } = require("pg");

const PORT = Number(process.env.PORT || 8080);

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");

const configuredUploadsDir =
  process.env.UPLOADS_DIR || "uploads";

const UPLOADS_DIR = path.isAbsolute(
  configuredUploadsDir
)
  ? configuredUploadsDir
  : path.join(ROOT_DIR, configuredUploadsDir);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

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

const ALLOWED_CATEGORIES = new Set([
  "moto",
  "carro",
  "romantico",
  "bbb",
]);

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      age INTEGER NOT NULL,
      city TEXT NOT NULL,
      neighborhood TEXT NOT NULL,
      preferences TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS businesses (
      id SERIAL PRIMARY KEY,
      owner_name TEXT NOT NULL,
      owner_email TEXT NOT NULL,
      owner_phone TEXT NOT NULL,
      business_name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      products TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      video_path TEXT NOT NULL,
      video_seconds DOUBLE PRECISION NOT NULL,
      status TEXT DEFAULT 'pendiente',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("✅ PostgreSQL inicializado");
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);

  res.writeHead(statusCode, {
    "Content-Type":
      "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });

  res.end(body);
}

function sendFile(res, absolutePath) {
  if (!fs.existsSync(absolutePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const ext = path
    .extname(absolutePath)
    .toLowerCase();

  res.writeHead(200, {
    "Content-Type":
      MIME_TYPES[ext] ||
      "application/octet-stream",
  });

  fs.createReadStream(absolutePath).pipe(res);
}

function cleanText(value) {
  return String(value || "").trim();
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");

  const hash = scryptSync(
    password,
    salt,
    64
  ).toString("hex");

  return `${salt}:${hash}`;
}

function readPublicPath(urlPathname) {
  let safePath = urlPathname;

  if (safePath === "/") {
    safePath = "/index.html";
  }

  safePath = safePath.replace(/^\/+/, "");

  return path.join(PUBLIC_DIR, safePath);
}

async function parseJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString();

  if (!raw) {
    return {};
  }

  return JSON.parse(raw);
}

const server = http.createServer(
  async (req, res) => {
    try {
      const host =
        req.headers.host ||
        `localhost:${PORT}`;

      const requestUrl = new URL(
        req.url || "/",
        `http://${host}`
      );

      const pathname = requestUrl.pathname;

      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin":
            "*",
          "Access-Control-Allow-Headers":
            "Content-Type",
          "Access-Control-Allow-Methods":
            "GET,POST,OPTIONS",
        });

        res.end();
        return;
      }

      // HEALTH
      if (
        pathname === "/api/health" &&
        req.method === "GET"
      ) {
        sendJson(res, 200, {
          ok: true,
          app: "parchar-v2",
        });

        return;
      }

      // REGISTRO USUARIO
      if (
        pathname ===
          "/api/users/register" &&
        req.method === "POST"
      ) {
        const body =
          await parseJsonBody(req);

        const passwordHash =
          hashPassword(body.password);

        await pool.query(
          `
          INSERT INTO users (
            full_name,
            email,
            phone,
            password_hash,
            age,
            city,
            neighborhood,
            preferences
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        `,
          [
            cleanText(body.fullName),
            cleanText(body.email),
            cleanText(body.phone),
            passwordHash,
            Number(body.age),
            cleanText(body.city),
            cleanText(
              body.neighborhood
            ),
            cleanText(body.preferences),
          ]
        );

        sendJson(res, 201, {
          ok: true,
          message: "Usuario creado",
        });

        return;
      }

      // CREAR NEGOCIO
      if (
        pathname === "/api/businesses" &&
        req.method === "POST"
      ) {
        const body =
          await parseJsonBody(req);

        const category = cleanText(
          body.category
        ).toLowerCase();

        if (
          !ALLOWED_CATEGORIES.has(
            category
          )
        ) {
          sendJson(res, 400, {
            error: "Categoria invalida",
          });

          return;
        }

        await pool.query(
          `
          INSERT INTO businesses (
            owner_name,
            owner_email,
            owner_phone,
            business_name,
            category,
            description,
            products,
            address,
            city,
            latitude,
            longitude,
            video_path,
            video_seconds,
            status
          )
          VALUES (
            $1,$2,$3,$4,$5,$6,$7,
            $8,$9,$10,$11,$12,$13,$14
          )
        `,
          [
            cleanText(body.ownerName),
            cleanText(body.ownerEmail),
            cleanText(body.ownerPhone),
            cleanText(body.businessName),
            category,
            cleanText(body.description),
            cleanText(body.products),
            cleanText(body.address),
            cleanText(body.city),
            Number(body.latitude),
            Number(body.longitude),
            cleanText(body.videoPath || ""),
            Number(
              body.videoSeconds || 10
            ),
            "pendiente",
          ]
        );

        sendJson(res, 201, {
          ok: true,
          message:
            "Negocio enviado para revision",
        });

        return;
      }

      // LISTAR NEGOCIOS
      if (
        pathname === "/api/businesses" &&
        req.method === "GET"
      ) {
        const category =
          requestUrl.searchParams.get(
            "category"
          ) || "";

        let query = `
          SELECT *
          FROM businesses
          WHERE status = 'pendiente'
        `;

        const values = [];

        if (category) {
          query +=
            " AND category = $1";

          values.push(category);
        }

        query += `
          ORDER BY created_at DESC
        `;

        const result =
          await pool.query(
            query,
            values
          );

        const items = result.rows.map(
          (item) => ({
            id: item.id,
            ownerName:
              item.owner_name,
            ownerEmail:
              item.owner_email,
            ownerPhone:
              item.owner_phone,
            businessName:
              item.business_name,
            category: item.category,
            description:
              item.description,
            products: item.products,
            address: item.address,
            city: item.city,
            latitude: item.latitude,
            longitude: item.longitude,
            videoUrl:
              item.video_path,
            videoSeconds:
              item.video_seconds,
            distanceKm: null,
          })
        );

        sendJson(res, 200, {
          items,
        });

        return;
      }

      // UPLOADS
      if (
        pathname.startsWith(
          "/uploads/"
        )
      ) {
        const relative =
          pathname.replace(
            /^\/uploads\//,
            ""
          );

        const absolutePath =
          path.join(
            UPLOADS_DIR,
            relative
          );

        sendFile(res, absolutePath);

        return;
      }

      // ARCHIVOS PUBLIC
      if (req.method === "GET") {
        const publicPath =
          readPublicPath(pathname);

        sendFile(res, publicPath);

        return;
      }

      sendJson(res, 404, {
        error: "Ruta no encontrada",
      });
    } catch (error) {
      console.error(error);

      sendJson(res, 500, {
        error:
          "Error interno servidor",
      });
    }
  }
);

initializeDatabase()
  .then(() => {
    server.listen(PORT, () => {
      console.log(
        `🔥 Parchar V2 corriendo en puerto ${PORT}`
      );
    });
  })
  .catch((error) => {
    console.error(
      "❌ Error inicializando DB",
      error
    );
  });

