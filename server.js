const http = require(
  "node:http"
);
const fs = require(
  "node:fs"
);
const path = require(
  "node:path"
);
const {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} = require("node:crypto");

const multer = require(
  "multer"
);
const cloudinary = require(
  "cloudinary"
).v2;
const { Pool } = require(
  "pg"
);

const PORT = Number(
  process.env.PORT || 8080
);
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.resolve(
  ROOT_DIR,
  "public"
);
const configuredUploadsDir =
  process.env.UPLOADS_DIR ||
  "uploads";
const configuredDataDir =
  process.env.DATA_DIR ||
  "data";
const UPLOADS_DIR =
  path.isAbsolute(
    configuredUploadsDir
  )
    ? configuredUploadsDir
    : path.resolve(
        ROOT_DIR,
        configuredUploadsDir
      );
const DATA_DIR =
  path.isAbsolute(
    configuredDataDir
  )
    ? configuredDataDir
    : path.resolve(
        ROOT_DIR,
        configuredDataDir
      );
const DB_PATH = path.join(
  DATA_DIR,
  "parchar.db"
);
const DATABASE_MODE = String(
  process.env.DATABASE_MODE ||
    "auto"
)
  .trim()
  .toLowerCase();
const DATABASE_URL = String(
  process.env.DATABASE_URL || ""
).trim();

if (
  !["auto", "sqlite", "postgres"].includes(
    DATABASE_MODE
  )
) {
  throw new Error(
    "DATABASE_MODE debe ser auto, sqlite o postgres."
  );
}

if (
  DATABASE_MODE === "postgres" &&
  !DATABASE_URL
) {
  throw new Error(
    "DATABASE_MODE=postgres requiere DATABASE_URL."
  );
}

if (
  DATABASE_MODE === "sqlite" &&
  DATABASE_URL
) {
  console.warn(
    "DATABASE_MODE=sqlite: se ignora DATABASE_URL y se usa el disco persistente."
  );
}

const USE_POSTGRES =
  DATABASE_MODE !== "sqlite" &&
  Boolean(DATABASE_URL);
const USE_CLOUDINARY =
  Boolean(
    process.env
      .CLOUDINARY_CLOUD_NAME &&
      process.env
        .CLOUDINARY_API_KEY &&
      process.env
        .CLOUDINARY_API_SECRET
  );
const VIDEO_MIN_SECONDS = 15;
const VIDEO_MAX_SECONDS = 20;
const ALLOWED_CATEGORIES =
  new Set([
    "moto",
    "carro",
    "romantico",
    "bbb",
  ]);
const STAFF_ROLES = new Set([
  "admin",
  "asesor",
]);
const DEFAULT_STAFF_ACCOUNTS = [
  {
    username:
      process.env.PARCHAR_ADMIN_USERNAME ||
      "admin",
    password:
      process.env.PARCHAR_ADMIN_PASSWORD ||
      "ParcharAdmin2026!",
    displayName: "Administrador Parchar",
    role: "admin",
  },
  {
    username:
      process.env.PARCHAR_ADVISOR_USERNAME ||
      "asesor",
    password:
      process.env.PARCHAR_ADVISOR_PASSWORD ||
      "ParcharAsesor2026!",
    displayName: "Asesor Parchar",
    role: "asesor",
  },
];

const MIME_TYPES = {
  ".css":
    "text/css; charset=utf-8",
  ".html":
    "text/html; charset=utf-8",
  ".ico":
    "image/x-icon",
  ".gif": "image/gif",
  ".jpeg":
    "image/jpeg",
  ".jpg":
    "image/jpeg",
  ".js":
    "application/javascript; charset=utf-8",
  ".json":
    "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".mov":
    "video/quicktime",
  ".pdf":
    "application/pdf",
  ".png": "image/png",
  ".svg":
    "image/svg+xml",
  ".webp": "image/webp",
  ".webmanifest":
    "application/manifest+json; charset=utf-8",
  ".webm": "video/webm",
};

cloudinary.config({
  cloud_name:
    process.env
      .CLOUDINARY_CLOUD_NAME,
  api_key:
    process.env
      .CLOUDINARY_API_KEY,
  api_secret:
    process.env
      .CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize:
      50 * 1024 * 1024,
  },
});

for (const dir of [
  PUBLIC_DIR,
  UPLOADS_DIR,
  DATA_DIR,
]) {
  fs.mkdirSync(dir, {
    recursive: true,
  });
}

const postgresSsl =
  USE_POSTGRES &&
  !/localhost|127\.0\.0\.1/i.test(
    DATABASE_URL
  )
    ? { rejectUnauthorized: false }
    : false;

const pool = USE_POSTGRES
  ? new Pool({
      connectionString:
        DATABASE_URL,
      ssl: postgresSsl,
    })
  : createSqlitePool();

function createSqlitePool() {
  const { DatabaseSync } = require(
    "node:sqlite"
  );
  const db = new DatabaseSync(
    DB_PATH
  );

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  return {
    dialect: "sqlite",
    exec(sql) {
      db.exec(sql);
      return Promise.resolve({
        rows: [],
        rowCount: 0,
      });
    },
    query(sql, params = []) {
      const prepared =
        prepareSqliteQuery(
          sql,
          params
        );
      const command =
        prepared.sql
          .trim()
          .split(/\s+/, 1)[0]
          .toUpperCase();

      if (
        command === "SELECT" ||
        command === "PRAGMA"
      ) {
        const rows = db
          .prepare(prepared.sql)
          .all(...prepared.params);

        return Promise.resolve({
          rows,
          rowCount: rows.length,
        });
      }

      const result = db
        .prepare(prepared.sql)
        .run(...prepared.params);

      return Promise.resolve({
        rows: [],
        rowCount: result.changes,
        lastID:
          result.lastInsertRowid,
      });
    },
  };
}

function prepareSqliteQuery(
  sql,
  params
) {
  const normalizeParam = (
    value
  ) => {
    if (
      typeof value ===
      "boolean"
    ) {
      return value ? 1 : 0;
    }

    if (
      value === undefined
    ) {
      return null;
    }

    return value;
  };
  const orderedParams = [];
  const sqliteSql = sql
    .replace(
      /NOW\(\)\s*\+\s*INTERVAL\s+'30 days'/gi,
      "datetime('now', '+30 days')"
    )
    .replace(
      /NOW\(\)/gi,
      "datetime('now')"
    )
    .replace(
      /\bTRUE\b/gi,
      "1"
    )
    .replace(
      /\bFALSE\b/gi,
      "0"
    )
    .replace(
      /\$(\d+)/g,
      (_, index) => {
        orderedParams.push(
          normalizeParam(
            params[
              Number(index) - 1
            ]
          )
        );
        return "?";
      }
    );

  return {
    sql: sqliteSql,
    params: orderedParams.length
      ? orderedParams
      : params.map(
          normalizeParam
        ),
  };
}

function cleanText(value) {
  return String(
    value || ""
  ).trim();
}

function cleanLimitedText(
  value,
  maxLength
) {
  return cleanText(value).slice(
    0,
    maxLength
  );
}

function parseBooleanFlag(value) {
  return [
    true,
    1,
    "true",
    "on",
    "1",
    "si",
  ].includes(
    typeof value === "string"
      ? value.trim().toLowerCase()
      : value
  );
}

function normalizeAdBanner(row) {
  return {
    enabled: Boolean(
      Number(row?.enabled || 0)
    ),
    title:
      row?.title || "Publicidad",
    message:
      row?.message ||
      "Espacio para aliados de Parchar",
    ctaLabel:
      row?.cta_label ||
      "Anunciar",
    advertiserName:
      row?.advertiser_name || "",
    mediaPath:
      row?.media_path || "",
    mediaType:
      row?.media_type || "",
    targetUrl:
      row?.target_url || "",
    updatedAt:
      row?.updated_at || null,
  };
}

function normalizeStaffUsername(value) {
  return cleanLimitedText(
    value,
    60
  ).toLowerCase();
}

function normalizeExternalUrl(value) {
  const raw = cleanText(value);

  if (!raw) {
    return "";
  }

  try {
    const url = new URL(raw);
    return ["http:", "https:"].includes(
      url.protocol
    )
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function normalizeCategory(
  rawValue
) {
  return String(rawValue || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );
}

function normalizePhone(
  value
) {
  return String(value || "")
    .replace(/[^0-9]/g, "")
    .trim();
}

function parseClientIdentifier(
  rawValue
) {
  const identifier =
    cleanText(rawValue);

  if (!identifier) {
    return null;
  }

  if (identifier.includes("@")) {
    return {
      type: "email",
      value:
        identifier.toLowerCase(),
    };
  }

  const phone =
    normalizePhone(
      identifier
    );

  if (!phone) {
    return null;
  }

  return {
    type: "phone",
    value: phone,
  };
}

function hashPassword(
  password
) {
  const salt = randomBytes(
    16
  ).toString("hex");
  const hash = scryptSync(
    password,
    salt,
    64
  ).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(
  password,
  stored
) {
  const parts =
    String(stored || "").split(
      ":"
    );

  if (parts.length !== 2) {
    return false;
  }

  const [salt, hashHex] =
    parts;

  if (!salt || !hashHex) {
    return false;
  }

  const computed =
    scryptSync(
      password,
      salt,
      64
    );

  const expected =
    Buffer.from(
      hashHex,
      "hex"
    );

  if (
    computed.length !==
    expected.length
  ) {
    return false;
  }

  return timingSafeEqual(
    computed,
    expected
  );
}

function hashToken(token) {
  return createHash("sha256")
    .update(String(token))
    .digest("hex");
}

function parseBearerToken(
  req
) {
  const authHeader =
    req.headers.authorization ||
    "";

  if (
    authHeader.startsWith(
      "Bearer "
    )
  ) {
    return authHeader
      .slice(7)
      .trim();
  }

  return cleanText(
    req.headers[
      "x-client-token"
    ]
  );
}

function validateLatitude(
  value
) {
  const lat = Number(value);
  if (
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90
  ) {
    return null;
  }
  return lat;
}

function validateLongitude(
  value
) {
  const lng = Number(value);
  if (
    !Number.isFinite(lng) ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  return lng;
}

function readPublicPath(
  urlPathname
) {
  const pathToUse =
    urlPathname === "/"
      ? "/loading.html"
      : urlPathname;

  const resolved =
    path.resolve(
      PUBLIC_DIR,
      `.${pathToUse}`
    );

  if (
    resolved === PUBLIC_DIR ||
    resolved.startsWith(
      `${PUBLIC_DIR}${path.sep}`
    )
  ) {
    return resolved;
  }

  return null;
}

function sendJson(
  res,
  statusCode,
  payload
) {
  const body = JSON.stringify(
    payload
  );

  res.writeHead(statusCode, {
    "Content-Type":
      "application/json; charset=utf-8",
    "Content-Length":
      Buffer.byteLength(body),
  });

  res.end(body);
}

function sendFile(
  res,
  absolutePath
) {
  if (
    !absolutePath ||
    !fs.existsSync(
      absolutePath
    )
  ) {
    res.writeHead(404, {
      "Content-Type":
        "text/plain; charset=utf-8",
    });
    res.end("Not found");
    return;
  }

  const ext = path
    .extname(absolutePath)
    .toLowerCase();
  const contentType =
    MIME_TYPES[ext] ||
    "application/octet-stream";

  const headers = {
    "Content-Type": contentType,
  };

  if (
    [".css", ".html", ".js"].includes(
      ext
    )
  ) {
    headers["Cache-Control"] =
      "no-cache";
  }

  if (
    path.basename(absolutePath) ===
    "service-worker.js"
  ) {
    headers["Cache-Control"] =
      "no-store, no-cache, must-revalidate";
  }

  res.writeHead(200, headers);
  fs.createReadStream(
    absolutePath
  ).pipe(res);
}

async function parseJsonBody(
  req
) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(
    chunks
  ).toString();
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
}

function runMiddleware(
  req,
  res,
  fn
) {
  return new Promise(
    (resolve, reject) => {
      fn(
        req,
        res,
        (result) => {
          if (
            result instanceof
            Error
          ) {
            reject(result);
            return;
          }
          resolve(result);
        }
      );
    }
  );
}

function extensionFromMime(
  mimetype
) {
  const known = {
    "application/pdf": ".pdf",
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
  };

  return (
    known[mimetype] || ""
  );
}

function safeUploadSegment(
  value
) {
  return (
    cleanText(value)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") ||
    "archivo"
  );
}

function safeUploadFolder(
  folder
) {
  return cleanText(folder || "files")
    .split(/[\\/]+/)
    .map(safeUploadSegment)
    .join("/");
}

async function saveLocalUpload(
  file,
  options = {}
) {
  const folder =
    safeUploadFolder(
      options.folder
    );
  const originalName =
    file.originalname || "archivo";
  const ext =
    path
      .extname(originalName)
      .toLowerCase() ||
    extensionFromMime(
      file.mimetype
    ) ||
    ".bin";
  const baseName =
    safeUploadSegment(
      path.basename(
        originalName,
        ext
      )
    );
  const fileName = `${Date.now()}-${randomBytes(
    4
  ).toString("hex")}-${baseName}${ext}`;
  const targetDir =
    path.resolve(
      UPLOADS_DIR,
      folder
    );

  if (
    targetDir !== UPLOADS_DIR &&
    !targetDir.startsWith(
      `${UPLOADS_DIR}${path.sep}`
    )
  ) {
    throw new Error(
      "Ruta de archivo invalida."
    );
  }

  fs.mkdirSync(targetDir, {
    recursive: true,
  });

  fs.writeFileSync(
    path.join(targetDir, fileName),
    file.buffer
  );

  return {
    secure_url: `/uploads/${folder}/${fileName}`,
  };
}

async function uploadToCloudinary(
  file,
  options
) {
  if (!USE_CLOUDINARY) {
    return saveLocalUpload(
      file,
      options
    );
  }

  return new Promise(
    (resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          options,
          (
            error,
            result
          ) => {
            if (error) {
              reject(error);
              return;
            }
            resolve(result);
          }
        )
        .end(file.buffer);
    }
  );
}

async function getClientFromToken(
  token
) {
  if (!token) {
    return null;
  }

  const tokenHash =
    hashToken(token);

  const result =
    await pool.query(
      `
      SELECT
        c.id,
        c.full_name AS "fullName",
        c.email,
        c.phone
      FROM client_sessions s
      JOIN clients c
        ON c.id = s.client_id
      WHERE
        s.token_hash = $1
        AND s.expires_at > NOW()
      LIMIT 1
      `,
      [tokenHash]
    );

  return (
    result.rows[0] || null
  );
}

async function requireClientAuth(
  req,
  res
) {
  const token =
    parseBearerToken(req);

  const client =
    await getClientFromToken(
      token
    );

  if (!client) {
    sendJson(res, 401, {
      error:
        "Debes iniciar sesion como cliente.",
    });
    return null;
  }

  return {
    token,
    client,
  };
}

async function getStaffFromToken(token) {
  if (!token) {
    return null;
  }

  const result = await pool.query(
    `
    SELECT
      u.id,
      u.username,
      u.display_name AS "displayName",
      u.role
    FROM staff_sessions s
    JOIN staff_users u
      ON u.id = s.staff_user_id
    WHERE
      s.token_hash = $1
      AND s.expires_at > NOW()
      AND u.active = TRUE
    LIMIT 1
    `,
    [hashToken(token)]
  );

  return result.rows[0] || null;
}

async function requireStaffAuth(
  req,
  res
) {
  const token = parseBearerToken(req);
  const staff = await getStaffFromToken(
    token
  );

  if (!staff) {
    sendJson(res, 401, {
      error:
        "Debes iniciar sesion como personal de Parchar.",
    });
    return null;
  }

  return {
    token,
    staff,
  };
}

function requireStaffRole(
  auth,
  res,
  roles
) {
  if (
    auth &&
    roles.includes(auth.staff.role)
  ) {
    return true;
  }

  sendJson(res, 403, {
    error:
      "Tu perfil no tiene permiso para esta accion.",
  });
  return false;
}

function assertSqliteIdentifier(
  value
) {
  if (
    !/^[a-z_][a-z0-9_]*$/i.test(
      value
    )
  ) {
    throw new Error(
      "Identificador SQLite invalido."
    );
  }
}

async function sqliteTableExists(
  tableName
) {
  assertSqliteIdentifier(
    tableName
  );

  const result =
    await pool.query(
      `
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name = $1
      LIMIT 1
      `,
      [tableName]
    );

  return Boolean(
    result.rows.length
  );
}

async function ensureSqliteColumn(
  tableName,
  columnName,
  definition
) {
  assertSqliteIdentifier(
    tableName
  );
  assertSqliteIdentifier(
    columnName
  );

  const result =
    await pool.query(
      `PRAGMA table_info(${tableName})`
    );
  const exists =
    result.rows.some(
      (column) =>
        column.name ===
        columnName
    );

  if (exists) {
    return;
  }

  await pool.exec(
    `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`
  );
}

async function normalizeSqliteClientPhones() {
  const result =
    await pool.query(`
      SELECT id, phone
      FROM clients
      WHERE phone_normalized IS NULL
         OR phone_normalized = ''
    `);

  for (const row of result.rows) {
    await pool.query(
      `
      UPDATE clients
      SET phone_normalized = $1
      WHERE id = $2
      `,
      [
        normalizePhone(row.phone),
        row.id,
      ]
    );
  }
}

async function migrateLegacyUsersToClients() {
  if (
    !(await sqliteTableExists(
      "users"
    ))
  ) {
    return;
  }

  const result =
    await pool.query(`
      SELECT
        u.full_name,
        u.email,
        u.phone,
        u.password_hash
      FROM users u
      WHERE NOT EXISTS (
        SELECT 1
        FROM clients c
        WHERE LOWER(c.email) = LOWER(u.email)
      )
    `);

  for (const user of result.rows) {
    await pool.query(
      `
      INSERT INTO clients (
        full_name,
        email,
        phone,
        phone_normalized,
        password_hash
      )
      VALUES ($1,$2,$3,$4,$5)
      `,
      [
        user.full_name,
        user.email,
        user.phone,
        normalizePhone(
          user.phone
        ),
        user.password_hash,
      ]
    );
  }
}

async function ensureStaffAccounts() {
  for (const account of DEFAULT_STAFF_ACCOUNTS) {
    const username =
      normalizeStaffUsername(
        account.username
      );

    if (
      !username ||
      !STAFF_ROLES.has(account.role)
    ) {
      continue;
    }

    const existing = await pool.query(
      `
      SELECT id
      FROM staff_users
      WHERE LOWER(username) = LOWER($1)
      LIMIT 1
      `,
      [username]
    );

    if (existing.rows.length) {
      continue;
    }

    await pool.query(
      `
      INSERT INTO staff_users (
        username,
        password_hash,
        display_name,
        role,
        active
      )
      VALUES ($1,$2,$3,$4,$5)
      `,
      [
        username,
        hashPassword(account.password),
        account.displayName,
        account.role,
        true,
      ]
    );
  }
}

async function ensureDefaultAdBanner() {
  const existing =
    await pool.query(`
      SELECT id
      FROM ad_banner_settings
      WHERE id = 1
      LIMIT 1
    `);

  if (existing.rows.length) {
    return;
  }

  await pool.query(
    `
    INSERT INTO ad_banner_settings (
      id,
      enabled,
      title,
      message,
      cta_label
    )
    VALUES ($1,$2,$3,$4,$5)
    `,
    [
      1,
      false,
      "Publicidad",
      "Espacio para aliados de Parchar",
      "Anunciar",
    ]
  );
}

async function normalizeDefaultAdBannerState() {
  await pool.query(`
    UPDATE ad_banner_settings
    SET enabled = FALSE
    WHERE
      id = 1
      AND COALESCE(advertiser_name, '') = ''
      AND COALESCE(media_path, '') = ''
      AND COALESCE(target_url, '') = ''
      AND message = 'Espacio para aliados de Parchar'
  `);
}

async function initializeSqliteDatabase() {
  await pool.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      phone_normalized TEXT,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.exec(`
    CREATE TABLE IF NOT EXISTS client_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.exec(`
    CREATE TABLE IF NOT EXISTS staff_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.exec(`
    CREATE TABLE IF NOT EXISTS staff_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_user_id INTEGER NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.exec(`
    CREATE TABLE IF NOT EXISTS businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      owner_name TEXT NOT NULL,
      owner_email TEXT NOT NULL,
      owner_phone TEXT NOT NULL,
      owner_document TEXT,
      business_name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      products TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      social_link TEXT,
      rut_document TEXT,
      commerce_document TEXT,
      legal_acceptance INTEGER DEFAULT 0,
      video_path TEXT NOT NULL,
      video_seconds REAL NOT NULL,
      status TEXT DEFAULT 'pendiente',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.exec(`
    CREATE TABLE IF NOT EXISTS ad_banner_settings (
      id INTEGER PRIMARY KEY,
      enabled INTEGER DEFAULT 0,
      title TEXT DEFAULT 'Publicidad',
      message TEXT DEFAULT 'Espacio para aliados de Parchar',
      cta_label TEXT DEFAULT 'Anunciar',
      advertiser_name TEXT,
      media_path TEXT,
      media_type TEXT,
      target_url TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.exec(`
    CREATE TABLE IF NOT EXISTS ad_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      business_name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      message TEXT NOT NULL,
      source_page TEXT,
      status TEXT DEFAULT 'pendiente',
      contacted_by TEXT,
      contacted_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await ensureSqliteColumn(
    "clients",
    "phone_normalized",
    "TEXT"
  );
  await ensureSqliteColumn(
    "businesses",
    "client_id",
    "INTEGER"
  );
  await ensureSqliteColumn(
    "businesses",
    "owner_document",
    "TEXT"
  );
  await ensureSqliteColumn(
    "businesses",
    "social_link",
    "TEXT"
  );
  await ensureSqliteColumn(
    "businesses",
    "rut_document",
    "TEXT"
  );
  await ensureSqliteColumn(
    "businesses",
    "commerce_document",
    "TEXT"
  );
  await ensureSqliteColumn(
    "businesses",
    "legal_acceptance",
    "INTEGER DEFAULT 0"
  );
  await ensureSqliteColumn(
    "businesses",
    "status",
    "TEXT DEFAULT 'activo'"
  );
  await ensureSqliteColumn(
    "ad_banner_settings",
    "advertiser_name",
    "TEXT"
  );
  await ensureSqliteColumn(
    "ad_banner_settings",
    "media_path",
    "TEXT"
  );
  await ensureSqliteColumn(
    "ad_banner_settings",
    "media_type",
    "TEXT"
  );
  await ensureSqliteColumn(
    "ad_banner_settings",
    "target_url",
    "TEXT"
  );
  await ensureSqliteColumn(
    "ad_requests",
    "contacted_by",
    "TEXT"
  );
  await ensureSqliteColumn(
    "ad_requests",
    "contacted_at",
    "TEXT"
  );

  await migrateLegacyUsersToClients();
  await normalizeSqliteClientPhones();
  await ensureStaffAccounts();
  await ensureDefaultAdBanner();
  await normalizeDefaultAdBannerState();

  await pool.query(`
    UPDATE businesses
    SET status = 'activo'
    WHERE status IS NULL
       OR status = ''
  `);

  await pool.query(`
    UPDATE businesses
    SET client_id = (
      SELECT c.id
      FROM clients c
      WHERE LOWER(c.email) = LOWER(businesses.owner_email)
      LIMIT 1
    )
    WHERE client_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM clients c
        WHERE LOWER(c.email) = LOWER(businesses.owner_email)
      )
  `);

  console.log(
    `SQLite inicializado en ${DB_PATH}`
  );
}

async function initializeDatabase() {
  if (!USE_POSTGRES) {
    await initializeSqliteDatabase();
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      phone_normalized TEXT,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_sessions (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS staff_users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS staff_sessions (
      id SERIAL PRIMARY KEY,
      staff_user_id INTEGER NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS businesses (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      owner_name TEXT NOT NULL,
      owner_email TEXT NOT NULL,
      owner_phone TEXT NOT NULL,
      owner_document TEXT,
      business_name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      products TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      social_link TEXT,
      rut_document TEXT,
      commerce_document TEXT,
      legal_acceptance BOOLEAN DEFAULT false,
      video_path TEXT NOT NULL,
      video_seconds DOUBLE PRECISION NOT NULL,
      status TEXT DEFAULT 'pendiente',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ad_banner_settings (
      id INTEGER PRIMARY KEY,
      enabled BOOLEAN DEFAULT false,
      title TEXT DEFAULT 'Publicidad',
      message TEXT DEFAULT 'Espacio para aliados de Parchar',
      cta_label TEXT DEFAULT 'Anunciar',
      advertiser_name TEXT,
      media_path TEXT,
      media_type TEXT,
      target_url TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ad_requests (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      business_name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      message TEXT NOT NULL,
      source_page TEXT,
      status TEXT DEFAULT 'pendiente',
      contacted_by TEXT,
      contacted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS phone_normalized TEXT;
  `);

  await pool.query(`
    UPDATE clients
    SET phone_normalized = REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g')
    WHERE phone_normalized IS NULL OR phone_normalized = '';
  `);

  await pool.query(`
    ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS client_id INTEGER;
  `);

  await pool.query(`
    ALTER TABLE ad_banner_settings
    ADD COLUMN IF NOT EXISTS advertiser_name TEXT,
    ADD COLUMN IF NOT EXISTS media_path TEXT,
    ADD COLUMN IF NOT EXISTS media_type TEXT,
    ADD COLUMN IF NOT EXISTS target_url TEXT;
  `);

  await pool.query(`
    ALTER TABLE ad_requests
    ADD COLUMN IF NOT EXISTS contacted_by TEXT,
    ADD COLUMN IF NOT EXISTS contacted_at TIMESTAMP;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'businesses_client_id_fkey'
      ) THEN
        ALTER TABLE businesses
        ADD CONSTRAINT businesses_client_id_fkey
        FOREIGN KEY (client_id)
        REFERENCES clients(id)
        ON DELETE SET NULL;
      END IF;
    END
    $$;
  `);

  await pool.query(`
    UPDATE businesses b
    SET client_id = c.id
    FROM clients c
    WHERE
      b.client_id IS NULL
      AND LOWER(b.owner_email) = LOWER(c.email);
  `);

  await ensureStaffAccounts();
  await ensureDefaultAdBanner();
  await normalizeDefaultAdBannerState();

  console.log(
    "PostgreSQL inicializado"
  );
}

const server =
  http.createServer(
    async (req, res) => {
      try {
        const host =
          req.headers.host ||
          `localhost:${PORT}`;

        const requestUrl =
          new URL(
            req.url || "/",
            `http://${host}`
          );

        const pathname =
          requestUrl.pathname;

        if (
          req.method ===
          "OPTIONS"
        ) {
          res.writeHead(204, {
            "Access-Control-Allow-Origin":
              "*",
            "Access-Control-Allow-Headers":
              "Content-Type, Authorization, X-Client-Token",
            "Access-Control-Allow-Methods":
              "GET,POST,OPTIONS",
          });
          res.end();
          return;
        }

        if (
          pathname ===
            "/api/health" &&
          req.method === "GET"
        ) {
          sendJson(res, 200, {
            ok: true,
            app: "parchar-v8",
          });
          return;
        }

        let staffAuth = null;

        if (
          pathname.startsWith(
            "/api/admin/"
          )
        ) {
          staffAuth =
            await requireStaffAuth(
              req,
              res
            );

          if (!staffAuth) {
            return;
          }
        }

        if (
          pathname ===
            "/api/staff/login" &&
          req.method === "POST"
        ) {
          const body = await parseJsonBody(
            req
          );
          const username =
            normalizeStaffUsername(
              body.username
            );
          const password = cleanText(
            body.password
          );

          if (!username || !password) {
            sendJson(res, 400, {
              error:
                "Escribe usuario y contrasena.",
            });
            return;
          }

          const result = await pool.query(
            `
            SELECT *
            FROM staff_users
            WHERE
              LOWER(username) = LOWER($1)
              AND active = TRUE
            LIMIT 1
            `,
            [username]
          );
          const staffRow = result.rows[0];

          if (
            !staffRow ||
            !verifyPassword(
              password,
              staffRow.password_hash
            )
          ) {
            sendJson(res, 401, {
              error:
                "Usuario o contrasena incorrectos.",
            });
            return;
          }

          const token = randomBytes(
            32
          ).toString("hex");

          await pool.query(
            `
            INSERT INTO staff_sessions (
              staff_user_id,
              token_hash,
              expires_at
            )
            VALUES ($1,$2,NOW() + INTERVAL '30 days')
            `,
            [
              staffRow.id,
              hashToken(token),
            ]
          );

          sendJson(res, 200, {
            ok: true,
            token,
            staff: {
              id: staffRow.id,
              username:
                staffRow.username,
              displayName:
                staffRow.display_name,
              role: staffRow.role,
            },
          });
          return;
        }

        if (
          pathname ===
            "/api/staff/me" &&
          req.method === "GET"
        ) {
          const auth =
            await requireStaffAuth(
              req,
              res
            );

          if (!auth) {
            return;
          }

          sendJson(res, 200, {
            ok: true,
            staff: auth.staff,
          });
          return;
        }

        if (
          pathname ===
            "/api/staff/logout" &&
          req.method === "POST"
        ) {
          const token =
            parseBearerToken(req);

          if (token) {
            await pool.query(
              `
              DELETE FROM staff_sessions
              WHERE token_hash = $1
              `,
              [hashToken(token)]
            );
          }

          sendJson(res, 200, {
            ok: true,
          });
          return;
        }

        if (
          pathname ===
            "/api/ads/banner" &&
          req.method === "GET"
        ) {
          const result =
            await pool.query(`
              SELECT *
              FROM ad_banner_settings
              WHERE id = 1
              LIMIT 1
            `);

          sendJson(res, 200, {
            banner:
              normalizeAdBanner(
                result.rows[0]
              ),
          });
          return;
        }

        if (
          pathname ===
            "/api/ads/requests" &&
          req.method === "POST"
        ) {
          const body =
            await parseJsonBody(
              req
            );

          const fullName =
            cleanLimitedText(
              body.fullName,
              120
            );
          const businessName =
            cleanLimitedText(
              body.businessName,
              140
            );
          const phone =
            cleanLimitedText(
              body.phone,
              80
            );
          const email =
            cleanLimitedText(
              body.email,
              160
            ).toLowerCase();
          const sourcePage =
            cleanLimitedText(
              body.sourcePage,
              200
            );
          const message =
            cleanLimitedText(
              body.message ||
                "Quiero recibir informacion para pautar publicidad en Parchar.",
              1200
            );

          if (
            !fullName ||
            !businessName ||
            (!phone && !email)
          ) {
            sendJson(res, 400, {
              error:
                "Deja tu nombre, negocio y telefono o correo para contactarte.",
            });
            return;
          }

          if (
            email &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
              email
            )
          ) {
            sendJson(res, 400, {
              error:
                "Escribe un correo valido.",
            });
            return;
          }

          await pool.query(
            `
            INSERT INTO ad_requests (
              full_name,
              business_name,
              phone,
              email,
              message,
              source_page,
              status
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            `,
            [
              fullName,
              businessName,
              phone,
              email,
              message,
              sourcePage,
              "pendiente",
            ]
          );

          sendJson(res, 201, {
            ok: true,
            message:
              "Solicitud enviada. El equipo de Parchar te contactara.",
          });
          return;
        }

        if (
          pathname ===
            "/api/clients/register" &&
          req.method === "POST"
        ) {
          const body =
            await parseJsonBody(
              req
            );

          const fullName =
            cleanText(
              body.fullName
            );
          const email =
            cleanText(
              body.email
            ).toLowerCase();
          const phone =
            cleanText(
              body.phone
            );
          const phoneNormalized =
            normalizePhone(
              body.phone
            );
          const password =
            cleanText(
              body.password
            );

          if (
            !fullName ||
            !email ||
            !phone ||
            !password
          ) {
            sendJson(res, 400, {
              error:
                "Completa nombre, correo, telefono y contrasena.",
            });
            return;
          }

          if (
            !email.includes("@")
          ) {
            sendJson(res, 400, {
              error:
                "Correo invalido.",
            });
            return;
          }

          if (
            phoneNormalized.length < 7
          ) {
            sendJson(res, 400, {
              error:
                "Telefono invalido.",
            });
            return;
          }

          if (
            password.length < 6
          ) {
            sendJson(res, 400, {
              error:
                "La contrasena debe tener al menos 6 caracteres.",
            });
            return;
          }

          const exists =
            await pool.query(
              `
              SELECT id
              FROM clients
              WHERE
                LOWER(email) = LOWER($1)
                OR phone_normalized = $2
              LIMIT 1
              `,
              [
                email,
                phoneNormalized,
              ]
            );

          if (
            exists.rows.length
          ) {
            sendJson(res, 409, {
              error:
                "Ese correo o telefono ya esta registrado.",
            });
            return;
          }

          await pool.query(
            `
            INSERT INTO clients (
              full_name,
              email,
              phone,
              phone_normalized,
              password_hash
            )
            VALUES ($1,$2,$3,$4,$5)
            `,
            [
              fullName,
              email,
              phone,
              phoneNormalized,
              hashPassword(
                password
              ),
            ]
          );

          sendJson(res, 201, {
            ok: true,
            message:
              "Cuenta cliente creada correctamente.",
          });
          return;
        }

        if (
          pathname ===
            "/api/clients/login" &&
          req.method === "POST"
        ) {
          const body =
            await parseJsonBody(
              req
            );

          const identifierRaw =
            cleanText(
              body.identifier ||
                body.email ||
                body.phone
            );
          const identifier =
            parseClientIdentifier(
              identifierRaw
            );
          const password =
            cleanText(
              body.password
            );

          if (
            !identifier ||
            !password
          ) {
            sendJson(res, 400, {
              error:
                "Usuario (correo o telefono) y contrasena son obligatorios.",
            });
            return;
          }

          const whereClause =
            identifier.type ===
            "email"
              ? "LOWER(email) = LOWER($1)"
              : "phone_normalized = $1";

          const result =
            await pool.query(
              `
              SELECT
                id,
                full_name AS "fullName",
                email,
                phone,
                password_hash
              FROM clients
              WHERE ${whereClause}
              LIMIT 1
              `,
              [identifier.value]
            );

          const account =
            result.rows[0];

          if (
            !account ||
            !verifyPassword(
              password,
              account.password_hash
            )
          ) {
            sendJson(res, 401, {
              error:
                "Credenciales invalidas.",
            });
            return;
          }

          const token =
            randomBytes(32).toString(
              "hex"
            );
          const tokenHash =
            hashToken(token);

          await pool.query(
            `
            INSERT INTO client_sessions (
              client_id,
              token_hash,
              expires_at
            )
            VALUES (
              $1,
              $2,
              NOW() + INTERVAL '30 days'
            )
            `,
            [
              account.id,
              tokenHash,
            ]
          );

          sendJson(res, 200, {
            ok: true,
            token,
            client: {
              id: account.id,
              fullName:
                account.fullName,
              email:
                account.email,
              phone:
                account.phone,
            },
          });
          return;
        }

        if (
          pathname ===
            "/api/clients/recover-username" &&
          req.method === "POST"
        ) {
          const body =
            await parseJsonBody(
              req
            );

          const fullName =
            cleanText(
              body.fullName
            );
          const phoneNormalized =
            normalizePhone(
              body.phone
            );

          if (
            !fullName ||
            phoneNormalized.length < 7
          ) {
            sendJson(res, 400, {
              error:
                "Debes indicar nombre y telefono registrados.",
            });
            return;
          }

          const result =
            await pool.query(
              `
              SELECT email
              FROM clients
              WHERE
                LOWER(full_name) = LOWER($1)
                AND phone_normalized = $2
              LIMIT 1
              `,
              [
                fullName,
                phoneNormalized,
              ]
            );

          if (
            !result.rows.length
          ) {
            sendJson(res, 404, {
              error:
                "No encontramos una cuenta con esos datos.",
            });
            return;
          }

          sendJson(res, 200, {
            ok: true,
            email:
              result.rows[0]
                .email,
          });
          return;
        }

        if (
          pathname ===
            "/api/clients/reset-password" &&
          req.method === "POST"
        ) {
          const body =
            await parseJsonBody(
              req
            );

          const identifier =
            parseClientIdentifier(
              body.identifier
            );
          const fullName =
            cleanText(
              body.fullName
            );
          const newPassword =
            cleanText(
              body.newPassword
            );

          if (
            !identifier ||
            !fullName ||
            !newPassword
          ) {
            sendJson(res, 400, {
              error:
                "Completa usuario (correo o telefono), nombre y nueva contrasena.",
            });
            return;
          }

          if (
            newPassword.length < 6
          ) {
            sendJson(res, 400, {
              error:
                "La nueva contrasena debe tener al menos 6 caracteres.",
            });
            return;
          }

          const whereIdentifier =
            identifier.type ===
            "email"
              ? "LOWER(email) = LOWER($1)"
              : "phone_normalized = $1";

          const accountResult =
            await pool.query(
              `
              SELECT id
              FROM clients
              WHERE
                ${whereIdentifier}
                AND LOWER(full_name) = LOWER($2)
              LIMIT 1
              `,
              [
                identifier.value,
                fullName,
              ]
            );

          if (
            !accountResult.rows
              .length
          ) {
            sendJson(res, 404, {
              error:
                "No pudimos validar tus datos de recuperacion.",
            });
            return;
          }

          const clientId =
            accountResult.rows[0]
              .id;

          await pool.query(
            `
            UPDATE clients
            SET password_hash = $1
            WHERE id = $2
            `,
            [
              hashPassword(
                newPassword
              ),
              clientId,
            ]
          );

          await pool.query(
            `
            DELETE FROM client_sessions
            WHERE client_id = $1
            `,
            [clientId]
          );

          sendJson(res, 200, {
            ok: true,
            message:
              "Contrasena actualizada. Inicia sesion nuevamente.",
          });
          return;
        }

        if (
          pathname ===
            "/api/clients/me" &&
          req.method === "GET"
        ) {
          const auth =
            await requireClientAuth(
              req,
              res
            );

          if (!auth) {
            return;
          }

          sendJson(res, 200, {
            ok: true,
            client:
              auth.client,
          });
          return;
        }

        if (
          pathname ===
            "/api/clients/businesses" &&
          req.method === "GET"
        ) {
          const auth =
            await requireClientAuth(
              req,
              res
            );

          if (!auth) {
            return;
          }

          const result =
            await pool.query(
              `
              SELECT
                id,
                business_name,
                category,
                city,
                status,
                created_at,
                video_path
              FROM businesses
              WHERE
                client_id = $1
                OR (
                  client_id IS NULL
                  AND LOWER(owner_email) = LOWER($2)
                )
              ORDER BY created_at DESC
              `,
              [
                auth.client.id,
                auth.client.email,
              ]
            );

          sendJson(res, 200, {
            ok: true,
            items:
              result.rows,
          });
          return;
        }

        if (
          pathname ===
            "/api/clients/logout" &&
          req.method === "POST"
        ) {
          const token =
            parseBearerToken(
              req
            );

          if (token) {
            await pool.query(
              `
              DELETE FROM client_sessions
              WHERE token_hash = $1
              `,
              [hashToken(token)]
            );
          }

          sendJson(res, 200, {
            ok: true,
          });
          return;
        }

        if (
          pathname ===
            "/api/businesses" &&
          req.method === "POST"
        ) {
          const auth =
            await requireClientAuth(
              req,
              res
            );

          if (!auth) {
            return;
          }

          await runMiddleware(
            req,
            res,
            upload.fields([
              {
                name: "video",
                maxCount: 1,
              },
              {
                name: "rutDocument",
                maxCount: 1,
              },
              {
                name:
                  "commerceDocument",
                maxCount: 1,
              },
            ])
          );

          const body =
            req.body || {};
          const category =
            normalizeCategory(
              body.category
            );
          const legalAcceptance =
            [
              "true",
              "on",
              "1",
              "si",
            ].includes(
              String(
                body.legalAcceptance ||
                  ""
              ).toLowerCase()
            );

          if (
            !ALLOWED_CATEGORIES.has(
              category
            )
          ) {
            sendJson(res, 400, {
              error:
                "Categoria invalida.",
            });
            return;
          }

          if (!legalAcceptance) {
            sendJson(res, 400, {
              error:
                "Debes aceptar la declaracion legal.",
            });
            return;
          }

          const businessName =
            cleanText(
              body.businessName
            );
          const description =
            cleanText(
              body.description
            );
          const products =
            cleanText(
              body.products
            );
          const address =
            cleanText(
              body.address
            );
          const city =
            cleanText(body.city);
          const socialLink =
            cleanText(
              body.socialLink ||
                ""
            );
          const ownerDocument =
            cleanText(
              body.ownerDocument
            );

          const latitude =
            validateLatitude(
              body.latitude
            );
          const longitude =
            validateLongitude(
              body.longitude
            );

          const videoSeconds =
            Number(
              body.videoDurationSeconds
            );

          if (
            !businessName ||
            !description ||
            !products ||
            !address ||
            !city ||
            latitude === null ||
            longitude === null ||
            !ownerDocument
          ) {
            sendJson(res, 400, {
              error:
                "Completa todos los campos obligatorios del negocio.",
            });
            return;
          }

          if (
            !Number.isFinite(
              videoSeconds
            ) ||
            videoSeconds <
              VIDEO_MIN_SECONDS ||
            videoSeconds >
              VIDEO_MAX_SECONDS
          ) {
            sendJson(res, 400, {
              error:
                `El video debe durar entre ${VIDEO_MIN_SECONDS} y ${VIDEO_MAX_SECONDS} segundos.`,
            });
            return;
          }

          const videoFile =
            req.files?.video?.[0];
          const rutFile =
            req.files
              ?.rutDocument?.[0];
          const commerceFile =
            req.files
              ?.commerceDocument?.[0];

          if (!videoFile) {
            sendJson(res, 400, {
              error:
                "Debes subir el video del local.",
            });
            return;
          }

          if (!rutFile) {
            sendJson(res, 400, {
              error:
                "Debes subir el RUT del negocio.",
            });
            return;
          }

          const duplicated =
            await pool.query(
              `
              SELECT id
              FROM businesses
              WHERE LOWER(business_name) = LOWER($1)
              LIMIT 1
              `,
              [businessName]
            );

          if (
            duplicated.rows
              .length
          ) {
            sendJson(res, 409, {
              error:
                "Ese negocio ya fue registrado.",
            });
            return;
          }

          const uploadedVideo =
            await uploadToCloudinary(
              videoFile,
              {
                resource_type:
                  "video",
                folder:
                  "parchar/videos",
              }
            );

          const uploadedRut =
            await uploadToCloudinary(
              rutFile,
              {
                resource_type:
                  "auto",
                folder:
                  "parchar/rut",
              }
            );

          let commerceUrl = "";
          if (commerceFile) {
            const uploadedCommerce =
              await uploadToCloudinary(
                commerceFile,
                {
                  resource_type:
                    "auto",
                  folder:
                    "parchar/commerce",
                }
              );
            commerceUrl =
              uploadedCommerce.secure_url;
          }

          await pool.query(
            `
            INSERT INTO businesses (
              client_id,
              owner_name,
              owner_email,
              owner_phone,
              owner_document,
              business_name,
              category,
              description,
              products,
              address,
              city,
              latitude,
              longitude,
              social_link,
              rut_document,
              commerce_document,
              legal_acceptance,
              video_path,
              video_seconds,
              status
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
              $11,$12,$13,$14,$15,$16,$17,$18,$19,$20
            )
            `,
            [
              auth.client.id,
              auth.client
                .fullName,
              auth.client
                .email,
              auth.client
                .phone,
              ownerDocument,
              businessName,
              category,
              description,
              products,
              address,
              city,
              latitude,
              longitude,
              socialLink,
              uploadedRut.secure_url,
              commerceUrl,
              true,
              uploadedVideo.secure_url,
              Number(
                videoSeconds.toFixed(
                  2
                )
              ),
              "pendiente",
            ]
          );

          sendJson(res, 201, {
            ok: true,
            message:
              "Negocio enviado para revision.",
          });
          return;
        }

        if (
          pathname ===
            "/api/admin/businesses" &&
          req.method === "GET"
        ) {
          if (
            !requireStaffRole(
              staffAuth,
              res,
              ["admin", "asesor"]
            )
          ) {
            return;
          }

          const result =
            await pool.query(`
              SELECT *
              FROM businesses
              ORDER BY created_at DESC
            `);

          sendJson(res, 200, {
            items:
              result.rows,
          });
          return;
        }

        if (
          pathname ===
            "/api/admin/ad-banner" &&
          req.method === "GET"
        ) {
          if (
            !requireStaffRole(
              staffAuth,
              res,
              ["admin"]
            )
          ) {
            return;
          }

          const result =
            await pool.query(`
              SELECT *
              FROM ad_banner_settings
              WHERE id = 1
              LIMIT 1
            `);

          sendJson(res, 200, {
            banner:
              normalizeAdBanner(
                result.rows[0]
              ),
          });
          return;
        }

        if (
          pathname ===
            "/api/admin/ad-banner" &&
          req.method === "POST"
        ) {
          if (
            !requireStaffRole(
              staffAuth,
              res,
              ["admin"]
            )
          ) {
            return;
          }

          await runMiddleware(
            req,
            res,
            upload.single("media")
          );

          const body = req.body || {};
          const enabled =
            parseBooleanFlag(
              body.enabled
            );
          const title =
            cleanLimitedText(
              body.title ||
                "Publicidad",
              60
            );
          const message =
            cleanLimitedText(
              body.message,
              180
            );
          const ctaLabel =
            cleanLimitedText(
              body.ctaLabel ||
                "Anunciar",
              40
            );
          const advertiserName =
            cleanLimitedText(
              body.advertiserName,
              120
            );
          const targetUrl =
            normalizeExternalUrl(
              body.targetUrl
            );
          const clearMedia =
            parseBooleanFlag(
              body.clearMedia
            );

          if (!message) {
            sendJson(res, 400, {
              error:
                "Escribe el texto del banner.",
            });
            return;
          }

          if (enabled && !advertiserName) {
            sendJson(res, 400, {
              error:
                "Escribe el cliente o marca antes de activar la campana.",
            });
            return;
          }

          if (targetUrl === null) {
            sendJson(res, 400, {
              error:
                "El enlace del anunciante debe comenzar con http:// o https://.",
            });
            return;
          }

          const currentResult =
            await pool.query(`
              SELECT media_path, media_type
              FROM ad_banner_settings
              WHERE id = 1
              LIMIT 1
            `);
          let mediaPath =
            currentResult.rows[0]
              ?.media_path || "";
          let mediaType =
            currentResult.rows[0]
              ?.media_type || "";

          if (clearMedia) {
            mediaPath = "";
            mediaType = "";
          }

          const mediaFile = req.file;

          if (mediaFile) {
            if (
              !/^(image|video)\//.test(
                mediaFile.mimetype || ""
              )
            ) {
              sendJson(res, 400, {
                error:
                  "La publicidad debe ser una imagen o un video.",
              });
              return;
            }

            const uploadedMedia =
              await uploadToCloudinary(
                mediaFile,
                {
                  resource_type: "auto",
                  folder:
                    "parchar/ads",
                }
              );
            mediaPath =
              uploadedMedia.secure_url;
            mediaType =
              mediaFile.mimetype;
          }

          if (enabled && !mediaPath) {
            sendJson(res, 400, {
              error:
                "Sube una imagen o video antes de activar la campana.",
            });
            return;
          }

          await pool.query(
            `
            UPDATE ad_banner_settings
            SET
              enabled = $1,
              title = $2,
              message = $3,
              cta_label = $4,
              advertiser_name = $5,
              media_path = $6,
              media_type = $7,
              target_url = $8,
              updated_at = NOW()
            WHERE id = 1
            `,
            [
              enabled,
              title,
              message,
              ctaLabel,
              advertiserName,
              mediaPath,
              mediaType,
              targetUrl,
            ]
          );

          sendJson(res, 200, {
            ok: true,
          });
          return;
        }

        if (
          pathname ===
            "/api/admin/ad-requests" &&
          req.method === "GET"
        ) {
          const result =
            await pool.query(`
              SELECT *
              FROM ad_requests
              ORDER BY created_at DESC
            `);

          sendJson(res, 200, {
            items:
              result.rows,
          });
          return;
        }

        if (
          pathname.match(
            /^\/api\/admin\/ad-requests\/\d+\/resolve$/
          ) &&
          req.method === "POST"
        ) {
          const id =
            pathname.split(
              "/"
            )[4];

          await pool.query(
            `
            UPDATE ad_requests
            SET
              status = 'contactado',
              contacted_by = $1,
              contacted_at = NOW()
            WHERE id = $2
            `,
            [
              staffAuth.staff.username,
              id,
            ]
          );

          sendJson(res, 200, {
            ok: true,
          });
          return;
        }

        if (
          pathname.match(
            /^\/api\/admin\/businesses\/\d+\/approve$/
          ) &&
          req.method === "POST"
        ) {
          if (
            !requireStaffRole(
              staffAuth,
              res,
              ["admin", "asesor"]
            )
          ) {
            return;
          }

          const id =
            pathname.split(
              "/"
            )[4];

          await pool.query(
            `
            UPDATE businesses
            SET status = 'activo'
            WHERE id = $1
            `,
            [id]
          );

          sendJson(res, 200, {
            ok: true,
          });
          return;
        }

        if (
          pathname.match(
            /^\/api\/admin\/businesses\/\d+\/reject$/
          ) &&
          req.method === "POST"
        ) {
          if (
            !requireStaffRole(
              staffAuth,
              res,
              ["admin", "asesor"]
            )
          ) {
            return;
          }

          const id =
            pathname.split(
              "/"
            )[4];

          const body =
            await parseJsonBody(
              req
            );
          const reason =
            cleanText(
              body.reason
            );

          await pool.query(
            `
            UPDATE businesses
            SET status = 'rechazado'
            WHERE id = $1
            `,
            [id]
          );

          sendJson(res, 200, {
            ok: true,
            message: reason
              ? `Negocio rechazado: ${reason}`
              : "Negocio rechazado.",
          });
          return;
        }

        if (
          pathname.match(
            /^\/api\/admin\/businesses\/\d+\/pause$/
          ) &&
          req.method === "POST"
        ) {
          if (
            !requireStaffRole(
              staffAuth,
              res,
              ["admin"]
            )
          ) {
            return;
          }

          const id =
            pathname.split(
              "/"
            )[4];

          await pool.query(
            `
            UPDATE businesses
            SET status = 'pausado'
            WHERE id = $1
            `,
            [id]
          );

          sendJson(res, 200, {
            ok: true,
          });
          return;
        }

        if (
          pathname.match(
            /^\/api\/admin\/businesses\/\d+\/activate$/
          ) &&
          req.method === "POST"
        ) {
          if (
            !requireStaffRole(
              staffAuth,
              res,
              ["admin"]
            )
          ) {
            return;
          }

          const id =
            pathname.split(
              "/"
            )[4];

          await pool.query(
            `
            UPDATE businesses
            SET status = 'activo'
            WHERE id = $1
            `,
            [id]
          );

          sendJson(res, 200, {
            ok: true,
          });
          return;
        }

        if (
          pathname.match(
            /^\/api\/admin\/businesses\/\d+\/edit$/
          ) &&
          req.method === "POST"
        ) {
          if (
            !requireStaffRole(
              staffAuth,
              res,
              ["admin"]
            )
          ) {
            return;
          }

          const id =
            pathname.split(
              "/"
            )[4];

          const body =
            await parseJsonBody(
              req
            );
          const businessName =
            cleanText(
              body.businessName
            );

          if (!businessName) {
            sendJson(res, 400, {
              error:
                "Debes enviar un nombre valido.",
            });
            return;
          }

          await pool.query(
            `
            UPDATE businesses
            SET business_name = $1
            WHERE id = $2
            `,
            [
              businessName,
              id,
            ]
          );

          sendJson(res, 200, {
            ok: true,
          });
          return;
        }

        if (
          pathname.match(
            /^\/api\/admin\/businesses\/\d+\/delete$/
          ) &&
          req.method === "POST"
        ) {
          if (
            !requireStaffRole(
              staffAuth,
              res,
              ["admin"]
            )
          ) {
            return;
          }

          const id =
            pathname.split(
              "/"
            )[4];

          await pool.query(
            `
            DELETE FROM businesses
            WHERE id = $1
            `,
            [id]
          );

          sendJson(res, 200, {
            ok: true,
          });
          return;
        }

        if (
          pathname ===
            "/api/businesses/approved" &&
          req.method === "GET"
        ) {
          const result =
            await pool.query(`
              SELECT *
              FROM businesses
              WHERE status = 'activo'
              ORDER BY created_at DESC
            `);

          sendJson(res, 200, {
            items:
              result.rows,
          });
          return;
        }

        if (
          pathname.startsWith(
            "/uploads/"
          ) &&
          req.method === "GET"
        ) {
          const relativeUploadPath =
            decodeURIComponent(
              pathname.replace(
                /^\/uploads\//,
                ""
              )
            );
          const uploadPath =
            path.resolve(
              UPLOADS_DIR,
              relativeUploadPath
            );

          if (
            uploadPath ===
              UPLOADS_DIR ||
            !uploadPath.startsWith(
              `${UPLOADS_DIR}${path.sep}`
            )
          ) {
            sendJson(res, 403, {
              error:
                "Acceso no permitido.",
            });
            return;
          }

          sendFile(
            res,
            uploadPath
          );
          return;
        }

        if (
          req.method === "GET"
        ) {
          const publicPath =
            readPublicPath(
              pathname
            );
          sendFile(
            res,
            publicPath
          );
          return;
        }

        sendJson(res, 404, {
          error:
            "Ruta no encontrada.",
        });
      } catch (error) {
        console.error(error);
        sendJson(res, 500, {
          error:
            "Error interno del servidor.",
        });
      }
    }
  );

initializeDatabase()
  .then(() => {
    server.listen(PORT, () => {
      console.log(
        `Parchar corriendo en puerto ${PORT}`
      );
    });
  })
  .catch((error) => {
    console.error(
      "Error inicializando DB",
      error
    );
    process.exit(1);
  });
