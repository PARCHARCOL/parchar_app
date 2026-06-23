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
const CLOUDINARY_CONFIGURED =
  Boolean(
    process.env
      .CLOUDINARY_CLOUD_NAME &&
      process.env
        .CLOUDINARY_API_KEY &&
      process.env
        .CLOUDINARY_API_SECRET
  );
const IS_RENDER_HOST =
  Boolean(
    process.env.RENDER ||
      process.env.RENDER_SERVICE_ID ||
      process.env.RENDER_EXTERNAL_URL
  );
const ALLOW_RENDER_SQLITE =
  String(
    process.env
      .ALLOW_RENDER_SQLITE || ""
  )
    .trim()
    .toLowerCase() === "true";
const ALLOW_RENDER_LOCAL_UPLOADS =
  String(
    process.env
      .ALLOW_RENDER_LOCAL_UPLOADS || ""
  )
    .trim()
    .toLowerCase() === "true";

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

if (
  IS_RENDER_HOST &&
  !ALLOW_RENDER_SQLITE &&
  (!DATABASE_URL ||
    DATABASE_MODE === "sqlite")
) {
  throw new Error(
    "Proteccion de datos: en Render no uses SQLite para produccion. Configura DATABASE_MODE=postgres y DATABASE_URL de Neon/Supabase. Si realmente tienes un disco persistente pago y quieres asumir el riesgo, define ALLOW_RENDER_SQLITE=true."
  );
}

if (
  IS_RENDER_HOST &&
  !ALLOW_RENDER_LOCAL_UPLOADS &&
  !CLOUDINARY_CONFIGURED
) {
  throw new Error(
    "Proteccion de archivos: en Render gratis los uploads locales se pueden borrar. Configura CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET. Si realmente tienes disco persistente pago y quieres asumir el riesgo, define ALLOW_RENDER_LOCAL_UPLOADS=true."
  );
}

const USE_POSTGRES =
  DATABASE_MODE !== "sqlite" &&
  Boolean(DATABASE_URL);
const USE_CLOUDINARY =
  CLOUDINARY_CONFIGURED;
const VIDEO_MIN_SECONDS = 15;
const VIDEO_MAX_SECONDS = 20;
const REVIEW_VIDEO_SECONDS = 15;
const REVIEW_VIDEO_TOLERANCE_SECONDS = 1;
const REVIEW_ACTIVE_DAYS = 15;
const AD_MEDIA_MAX_BYTES =
  15 * 1024 * 1024;
const REVIEW_VIDEO_MAX_BYTES =
  25 * 1024 * 1024;
const ALLOWED_CATEGORIES =
  new Set([
    "moto",
    "carro",
    "romantico",
    "bbb",
  ]);
const ALLOWED_AD_MEDIA_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "video/quicktime",
  ]);
const ALLOWED_DOCUMENT_TYPES =
  new Set([
    "application/pdf",
  ]);
const ALLOWED_REVIEW_VIDEO_TYPES =
  new Set([
    "video/mp4",
    "video/webm",
    "video/quicktime",
  ]);
const AD_CAMPAIGN_STATUSES =
  new Set([
    "activa",
    "pausada",
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

function parseDateOnly(value) {
  const raw = cleanText(value);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      raw
    )
  ) {
    return null;
  }

  const date = new Date(
    `${raw}T00:00:00.000Z`
  );

  if (
    Number.isNaN(date.getTime())
  ) {
    return null;
  }

  return raw;
}

function dateOnlyToStartIso(value) {
  return `${value}T00:00:00.000Z`;
}

function dateOnlyToEndIso(value) {
  return `${value}T23:59:59.999Z`;
}

function formatDateOnly(value) {
  if (!value) {
    return "";
  }

  const match =
    String(value).match(
      /^(\d{4}-\d{2}-\d{2})/
    );

  if (match) {
    return match[1];
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "";
  }

  return date
    .toISOString()
    .slice(0, 10);
}

function getCampaignComputedStatus(row) {
  const baseStatus =
    row?.status || "pausada";

  if (baseStatus !== "activa") {
    return baseStatus;
  }

  const now = Date.now();
  const startsAt = new Date(
    row.starts_at || row.startsAt || ""
  ).getTime();
  const endsAt = new Date(
    row.ends_at || row.endsAt || ""
  ).getTime();

  if (
    Number.isFinite(startsAt) &&
    startsAt > now
  ) {
    return "programada";
  }

  if (
    Number.isFinite(endsAt) &&
    endsAt < now
  ) {
    return "vencida";
  }

  return "activa";
}

function normalizeAdCampaign(row) {
  if (!row) {
    return null;
  }

  const priority = Math.max(
    1,
    Math.min(
      10,
      Number(row.priority || 1)
    )
  );

  return {
    id: row.id,
    enabled:
      getCampaignComputedStatus(row) ===
      "activa",
    status:
      row.status || "pausada",
    computedStatus:
      getCampaignComputedStatus(row),
    advertiserName:
      row.advertiser_name || "",
    title:
      row.title || "Publicidad",
    message:
      row.message || "",
    ctaLabel:
      row.cta_label || "Anunciar",
    mediaPath:
      row.media_path || "",
    mediaType:
      row.media_type || "",
    targetUrl:
      row.target_url || "",
    startsAt:
      row.starts_at || null,
    endsAt:
      row.ends_at || null,
    startDate: formatDateOnly(
      row.starts_at
    ),
    endDate: formatDateOnly(
      row.ends_at
    ),
    priority,
    impressions: Number(
      row.impressions || 0
    ),
    clicks: Number(
      row.clicks || 0
    ),
    createdAt:
      row.created_at || null,
    updatedAt:
      row.updated_at || null,
  };
}

function selectRotatingCampaign(rows) {
  const active = rows
    .map(normalizeAdCampaign)
    .filter(
      (item) =>
        item &&
        item.computedStatus ===
          "activa" &&
        item.mediaPath
    );

  if (!active.length) {
    return null;
  }

  return active.sort((a, b) => {
    const aScore =
      a.impressions /
      Math.max(1, a.priority);
    const bScore =
      b.impressions /
      Math.max(1, b.priority);

    if (aScore !== bScore) {
      return aScore - bScore;
    }

    return (
      Number(a.id || 0) -
      Number(b.id || 0)
    );
  })[0];
}

function normalizeStaffUsername(value) {
  return cleanLimitedText(
    value,
    60
  ).toLowerCase();
}

function isValidStaffUsername(value) {
  return /^[a-z0-9._-]{3,60}$/.test(
    String(value || "")
  );
}

function normalizeStaffUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    displayName:
      row.displayName ||
      row.display_name ||
      row.username,
    role: row.role,
    active: Boolean(
      Number(row.active)
    ),
    createdAt:
      row.created_at || null,
  };
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

function getRequestVisitorKey(
  req,
  providedKey
) {
  const cleaned =
    cleanLimitedText(
      providedKey,
      100
    );

  if (cleaned) {
    return cleaned;
  }

  const forwardedFor = String(
    req.headers[
      "x-forwarded-for"
    ] || ""
  )
    .split(",")[0]
    .trim();
  const remoteAddress =
    req.socket?.remoteAddress ||
    "";
  const userAgent =
    req.headers[
      "user-agent"
    ] || "";

  return `anon-${createHash(
    "sha256"
  )
    .update(
      `${forwardedFor || remoteAddress}|${userAgent}`
    )
    .digest("hex")
    .slice(0, 40)}`;
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
    "Cache-Control":
      "no-store, no-cache, must-revalidate",
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

function isPdfDocument(file) {
  if (!file) {
    return false;
  }

  return (
    ALLOWED_DOCUMENT_TYPES.has(
      file.mimetype
    ) ||
    path
      .extname(
        file.originalname || ""
      )
      .toLowerCase() === ".pdf"
  );
}

function isAllowedReviewVideo(file) {
  return Boolean(
    file &&
      ALLOWED_REVIEW_VIDEO_TYPES.has(
        file.mimetype
      )
  );
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

  await resetAdminPasswordFromEnv();
}

async function resetAdminPasswordFromEnv() {
  const recoveryPassword =
    cleanText(
      process.env
        .PARCHAR_ADMIN_RESET_PASSWORD
    );

  if (!recoveryPassword) {
    return;
  }

  if (recoveryPassword.length < 8) {
    throw new Error(
      "PARCHAR_ADMIN_RESET_PASSWORD debe tener minimo 8 caracteres."
    );
  }

  const recoveryUsername =
    normalizeStaffUsername(
      process.env
        .PARCHAR_ADMIN_RESET_USERNAME ||
        process.env
          .PARCHAR_ADMIN_USERNAME ||
        "admin"
    );

  const existing = await pool.query(
    `
    SELECT id
    FROM staff_users
    WHERE LOWER(username) = LOWER($1)
    LIMIT 1
    `,
    [recoveryUsername]
  );

  if (existing.rows.length) {
    const staffId =
      existing.rows[0].id;

    await pool.query(
      `
      UPDATE staff_users
      SET
        password_hash = $1,
        role = 'admin',
        active = TRUE
      WHERE id = $2
      `,
      [
        hashPassword(
          recoveryPassword
        ),
        staffId,
      ]
    );

    await pool.query(
      `
      DELETE FROM staff_sessions
      WHERE staff_user_id = $1
      `,
      [staffId]
    );
  } else {
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
        recoveryUsername,
        hashPassword(
          recoveryPassword
        ),
        "Administrador Parchar",
        "admin",
        true,
      ]
    );
  }

  console.warn(
    `Clave de admin reseteada desde PARCHAR_ADMIN_RESET_PASSWORD para ${recoveryUsername}. Retira esa variable despues de entrar.`
  );
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
      reviewed_by TEXT,
      reviewed_at TEXT,
      review_note TEXT,
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
    CREATE TABLE IF NOT EXISTS ad_campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      advertiser_name TEXT NOT NULL,
      title TEXT DEFAULT 'Publicidad',
      message TEXT NOT NULL,
      cta_label TEXT DEFAULT 'Anunciar',
      media_path TEXT NOT NULL,
      media_type TEXT NOT NULL,
      target_url TEXT,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      priority INTEGER DEFAULT 1,
      status TEXT DEFAULT 'pausada',
      impressions INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
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

  await pool.exec(`
    CREATE TABLE IF NOT EXISTS business_parches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      visitor_key TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(business_id, visitor_key)
    );
  `);

  await pool.exec(`
    CREATE TABLE IF NOT EXISTS business_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      visitor_key TEXT,
      video_path TEXT NOT NULL,
      video_seconds REAL NOT NULL,
      status TEXT DEFAULT 'activa',
      expires_at TEXT NOT NULL,
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
    "businesses",
    "reviewed_by",
    "TEXT"
  );
  await ensureSqliteColumn(
    "businesses",
    "reviewed_at",
    "TEXT"
  );
  await ensureSqliteColumn(
    "businesses",
    "review_note",
    "TEXT"
  );
  await pool.exec(`
    CREATE INDEX IF NOT EXISTS idx_business_parches_business
    ON business_parches (business_id);
  `);
  await pool.exec(`
    CREATE INDEX IF NOT EXISTS idx_business_reviews_active
    ON business_reviews (business_id, status, expires_at);
  `);
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
      reviewed_by TEXT,
      reviewed_at TIMESTAMP,
      review_note TEXT,
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
    CREATE TABLE IF NOT EXISTS ad_campaigns (
      id SERIAL PRIMARY KEY,
      advertiser_name TEXT NOT NULL,
      title TEXT DEFAULT 'Publicidad',
      message TEXT NOT NULL,
      cta_label TEXT DEFAULT 'Anunciar',
      media_path TEXT NOT NULL,
      media_type TEXT NOT NULL,
      target_url TEXT,
      starts_at TIMESTAMP NOT NULL,
      ends_at TIMESTAMP NOT NULL,
      priority INTEGER DEFAULT 1,
      status TEXT DEFAULT 'pausada',
      impressions INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
    CREATE TABLE IF NOT EXISTS business_parches (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      visitor_key TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(business_id, visitor_key)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS business_reviews (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      visitor_key TEXT,
      video_path TEXT NOT NULL,
      video_seconds DOUBLE PRECISION NOT NULL,
      status TEXT DEFAULT 'activa',
      expires_at TIMESTAMP NOT NULL,
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
    ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS review_note TEXT;
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
    CREATE INDEX IF NOT EXISTS idx_business_parches_business
    ON business_parches (business_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_business_reviews_active
    ON business_reviews (business_id, status, expires_at);
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
            "/api/staff/password" &&
          req.method === "POST"
        ) {
          const auth =
            await requireStaffAuth(
              req,
              res
            );

          if (!auth) {
            return;
          }

          const body = await parseJsonBody(
            req
          );
          const currentPassword =
            cleanText(
              body.currentPassword
            );
          const newPassword = cleanText(
            body.newPassword
          );

          if (
            !currentPassword ||
            !newPassword
          ) {
            sendJson(res, 400, {
              error:
                "Escribe la clave actual y la nueva clave.",
            });
            return;
          }

          if (newPassword.length < 8) {
            sendJson(res, 400, {
              error:
                "La nueva clave debe tener minimo 8 caracteres.",
            });
            return;
          }

          const result = await pool.query(
            `
            SELECT password_hash
            FROM staff_users
            WHERE id = $1 AND active = TRUE
            LIMIT 1
            `,
            [auth.staff.id]
          );
          const staffRow = result.rows[0];

          if (
            !staffRow ||
            !verifyPassword(
              currentPassword,
              staffRow.password_hash
            )
          ) {
            sendJson(res, 401, {
              error:
                "La clave actual no es correcta.",
            });
            return;
          }

          await pool.query(
            `
            UPDATE staff_users
            SET password_hash = $1
            WHERE id = $2
            `,
            [
              hashPassword(newPassword),
              auth.staff.id,
            ]
          );

          await pool.query(
            `
            DELETE FROM staff_sessions
            WHERE staff_user_id = $1
              AND token_hash <> $2
            `,
            [
              auth.staff.id,
              hashToken(auth.token),
            ]
          );

          sendJson(res, 200, {
            ok: true,
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
          const campaignResult =
            await pool.query(`
              SELECT *
              FROM ad_campaigns
              WHERE status = 'activa'
              ORDER BY priority DESC, created_at DESC
            `);
          const campaign =
            selectRotatingCampaign(
              campaignResult.rows
            );

          if (campaign) {
            await pool.query(
              `
              UPDATE ad_campaigns
              SET impressions = COALESCE(impressions, 0) + 1,
                  updated_at = NOW()
              WHERE id = $1
              `,
              [campaign.id]
            );

            sendJson(res, 200, {
              banner: campaign,
            });
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
            banner: {
              ...normalizeAdBanner(
                result.rows[0]
              ),
              enabled: false,
            },
          });
          return;
        }

        if (
          pathname.match(
            /^\/api\/ads\/campaigns\/\d+\/click$/
          ) &&
          req.method === "POST"
        ) {
          const id =
            pathname.split(
              "/"
            )[4];

          await pool.query(
            `
            UPDATE ad_campaigns
            SET clicks = COALESCE(clicks, 0) + 1,
                updated_at = NOW()
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

          if (!isPdfDocument(rutFile)) {
            sendJson(res, 400, {
              error:
                "El RUT debe subirse en formato PDF.",
            });
            return;
          }

          if (
            commerceFile &&
            !isPdfDocument(commerceFile)
          ) {
            sendJson(res, 400, {
              error:
                "La Camara de Comercio debe subirse en formato PDF.",
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
                  "raw",
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
                    "raw",
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
            "/api/admin/staff-users" &&
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
              SELECT
                id,
                username,
                display_name AS "displayName",
                role,
                active,
                created_at
              FROM staff_users
              ORDER BY role ASC, display_name ASC
            `);

          sendJson(res, 200, {
            items: result.rows.map(
              normalizeStaffUser
            ),
          });
          return;
        }

        if (
          pathname ===
            "/api/admin/staff-users" &&
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

          const body =
            await parseJsonBody(
              req
            );
          const username =
            normalizeStaffUsername(
              body.username
            );
          const displayName =
            cleanLimitedText(
              body.displayName,
              120
            ) || username;
          const password = cleanText(
            body.password
          );

          if (
            !username ||
            !isValidStaffUsername(
              username
            )
          ) {
            sendJson(res, 400, {
              error:
                "El usuario debe tener minimo 3 caracteres y usar solo letras, numeros, punto, guion o guion bajo.",
            });
            return;
          }

          if (password.length < 8) {
            sendJson(res, 400, {
              error:
                "La clave debe tener minimo 8 caracteres.",
            });
            return;
          }

          const duplicated =
            await pool.query(
              `
              SELECT id
              FROM staff_users
              WHERE LOWER(username) = LOWER($1)
              LIMIT 1
              `,
              [username]
            );

          if (
            duplicated.rows.length
          ) {
            sendJson(res, 409, {
              error:
                "Ese usuario interno ya existe.",
            });
            return;
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
              hashPassword(password),
              displayName,
              "asesor",
              true,
            ]
          );

          const created =
            await pool.query(
              `
              SELECT
                id,
                username,
                display_name AS "displayName",
                role,
                active,
                created_at
              FROM staff_users
              WHERE LOWER(username) = LOWER($1)
              LIMIT 1
              `,
              [username]
            );

          sendJson(res, 201, {
            ok: true,
            staff:
              normalizeStaffUser(
                created.rows[0]
              ),
          });
          return;
        }

        if (
          pathname.match(
            /^\/api\/admin\/staff-users\/\d+\/status$/
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

          if (
            Number(id) ===
            Number(staffAuth.staff.id)
          ) {
            sendJson(res, 400, {
              error:
                "No puedes desactivar tu propia cuenta.",
            });
            return;
          }

          const body =
            await parseJsonBody(
              req
            );
          const active =
            parseBooleanFlag(
              body.active
            );

          const existing =
            await pool.query(
              `
              SELECT id, role
              FROM staff_users
              WHERE id = $1
              LIMIT 1
              `,
              [id]
            );
          const staffRow =
            existing.rows[0];

          if (!staffRow) {
            sendJson(res, 404, {
              error:
                "Usuario interno no encontrado.",
            });
            return;
          }

          if (
            staffRow.role !== "asesor"
          ) {
            sendJson(res, 400, {
              error:
                "Desde este panel solo se activan o desactivan asesores.",
            });
            return;
          }

          await pool.query(
            `
            UPDATE staff_users
            SET active = $1
            WHERE id = $2
            `,
            [active, id]
          );

          if (!active) {
            await pool.query(
              `
              DELETE FROM staff_sessions
              WHERE staff_user_id = $1
              `,
              [id]
            );
          }

          sendJson(res, 200, {
            ok: true,
          });
          return;
        }

        if (
          pathname ===
            "/api/admin/ad-campaigns" &&
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
              FROM ad_campaigns
              ORDER BY created_at DESC
            `);

          sendJson(res, 200, {
            items: result.rows.map(
              normalizeAdCampaign
            ),
          });
          return;
        }

        if (
          pathname ===
            "/api/admin/ad-campaigns" &&
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
          const advertiserName =
            cleanLimitedText(
              body.advertiserName,
              120
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
          const targetUrl =
            normalizeExternalUrl(
              body.targetUrl
            );
          const startDate =
            parseDateOnly(
              body.startDate
            );
          const endDate =
            parseDateOnly(
              body.endDate
            );
          const startsAt =
            startDate
              ? dateOnlyToStartIso(
                  startDate
                )
              : "";
          const endsAt =
            endDate
              ? dateOnlyToEndIso(
                  endDate
                )
              : "";
          const priority = Math.max(
            1,
            Math.min(
              10,
              Number(
                body.priority || 1
              )
            )
          );
          const status =
            AD_CAMPAIGN_STATUSES.has(
              cleanText(body.status)
            )
              ? cleanText(body.status)
              : "pausada";

          if (
            !advertiserName ||
            !message
          ) {
            sendJson(res, 400, {
              error:
                "Escribe cliente o marca y texto del banner.",
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

          if (!targetUrl) {
            sendJson(res, 400, {
              error:
                "Agrega el enlace de destino para el boton Ver oferta.",
            });
            return;
          }

          if (
            !startDate ||
            !endDate
          ) {
            sendJson(res, 400, {
              error:
                "Selecciona fecha de inicio y fecha de fin.",
            });
            return;
          }

          if (
            new Date(startsAt).getTime() >
            new Date(endsAt).getTime()
          ) {
            sendJson(res, 400, {
              error:
                "La fecha de inicio no puede ser posterior a la fecha de fin.",
            });
            return;
          }

          if (
            new Date(endsAt).getTime() <
            Date.now()
          ) {
            sendJson(res, 400, {
              error:
                "No puedes crear una campana vencida.",
            });
            return;
          }

          const mediaFile = req.file;

          if (!mediaFile) {
            sendJson(res, 400, {
              error:
                "Sube la imagen o video de la pauta.",
            });
            return;
          }

          if (
            !ALLOWED_AD_MEDIA_TYPES.has(
              mediaFile.mimetype || ""
            )
          ) {
            sendJson(res, 400, {
              error:
                "La publicidad debe ser JPG, PNG, WEBP, GIF, MP4, WEBM o MOV.",
            });
            return;
          }

          if (
            mediaFile.size >
            AD_MEDIA_MAX_BYTES
          ) {
            sendJson(res, 400, {
              error:
                "El archivo de publicidad no debe superar 15 MB.",
            });
            return;
          }

          const uploadedMedia =
            await uploadToCloudinary(
              mediaFile,
              {
                resource_type:
                  "auto",
                folder:
                  "parchar/ads",
              }
            );

          await pool.query(
            `
            INSERT INTO ad_campaigns (
              advertiser_name,
              title,
              message,
              cta_label,
              media_path,
              media_type,
              target_url,
              starts_at,
              ends_at,
              priority,
              status,
              created_by,
              updated_at
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
            `,
            [
              advertiserName,
              title,
              message,
              ctaLabel,
              uploadedMedia.secure_url,
              mediaFile.mimetype,
              targetUrl || "",
              startsAt,
              endsAt,
              priority,
              status,
              staffAuth.staff.username,
            ]
          );

          sendJson(res, 201, {
            ok: true,
          });
          return;
        }

        if (
          pathname.match(
            /^\/api\/admin\/ad-campaigns\/\d+\/status$/
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
          const status =
            cleanText(
              body.status
            );

          if (
            !AD_CAMPAIGN_STATUSES.has(
              status
            )
          ) {
            sendJson(res, 400, {
              error:
                "Estado de campana invalido.",
            });
            return;
          }

          const existing =
            await pool.query(
              `
              SELECT *
              FROM ad_campaigns
              WHERE id = $1
              LIMIT 1
              `,
              [id]
            );
          const campaign =
            existing.rows[0];

          if (!campaign) {
            sendJson(res, 404, {
              error:
                "Campana no encontrada.",
            });
            return;
          }

          if (
            status === "activa" &&
            new Date(
              campaign.ends_at
            ).getTime() < Date.now()
          ) {
            sendJson(res, 400, {
              error:
                "No puedes activar una campana vencida.",
            });
            return;
          }

          await pool.query(
            `
            UPDATE ad_campaigns
            SET status = $1,
                updated_at = NOW()
            WHERE id = $2
            `,
            [
              status,
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
            /^\/api\/admin\/ad-campaigns\/\d+\/delete$/
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
            DELETE FROM ad_campaigns
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
              !ALLOWED_AD_MEDIA_TYPES.has(
                mediaFile.mimetype || ""
              )
            ) {
              sendJson(res, 400, {
                error:
                  "La publicidad debe ser JPG, PNG, WEBP, GIF, MP4, WEBM o MOV.",
              });
              return;
            }

            if (
              mediaFile.size >
              AD_MEDIA_MAX_BYTES
            ) {
              sendJson(res, 400, {
                error:
                  "El archivo de publicidad no debe superar 15 MB.",
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
            SET
              status = 'activo',
              reviewed_by = $1,
              reviewed_at = NOW(),
              review_note = $2
            WHERE id = $3
            `,
            [
              staffAuth.staff.username,
              "Aprobado",
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
            cleanLimitedText(
              body.reason,
              180
            );

          await pool.query(
            `
            UPDATE businesses
            SET
              status = 'rechazado',
              reviewed_by = $1,
              reviewed_at = NOW(),
              review_note = $2
            WHERE id = $3
            `,
            [
              staffAuth.staff.username,
              reason || "Rechazado",
              id,
            ]
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
            SET
              status = 'pausado',
              reviewed_by = $1,
              reviewed_at = NOW(),
              review_note = $2
            WHERE id = $3
            `,
            [
              staffAuth.staff.username,
              "Pausado por admin",
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
            SET
              status = 'activo',
              reviewed_by = $1,
              reviewed_at = NOW(),
              review_note = $2
            WHERE id = $3
            `,
            [
              staffAuth.staff.username,
              "Activado por admin",
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
          pathname.match(
            /^\/api\/businesses\/\d+\/parchar$/
          ) &&
          req.method === "POST"
        ) {
          const id =
            pathname.split(
              "/"
            )[3];
          const body =
            await parseJsonBody(
              req
            );
          const visitorKey =
            getRequestVisitorKey(
              req,
              body.visitorKey,
            );

          const business =
            await pool.query(
              `
              SELECT id
              FROM businesses
              WHERE id = $1 AND status = 'activo'
              LIMIT 1
              `,
              [id]
            );

          if (!business.rows.length) {
            sendJson(res, 404, {
              error:
                "Local no disponible.",
            });
            return;
          }

          let already = false;

          try {
            await pool.query(
              `
              INSERT INTO business_parches (
                business_id,
                visitor_key
              )
              VALUES ($1,$2)
              `,
              [id, visitorKey]
            );
          } catch {
            already = true;
          }

          const countResult =
            await pool.query(
              `
              SELECT COUNT(*) AS count
              FROM business_parches
              WHERE business_id = $1
              `,
              [id]
            );

          sendJson(res, 200, {
            ok: true,
            already,
            count: Number(
              countResult.rows[0]
                ?.count || 0
            ),
          });
          return;
        }

        if (
          pathname.match(
            /^\/api\/businesses\/\d+\/reviews$/
          ) &&
          req.method === "POST"
        ) {
          const id =
            pathname.split(
              "/"
            )[3];

          await runMiddleware(
            req,
            res,
            upload.single("reviewVideo")
          );

          const business =
            await pool.query(
              `
              SELECT id
              FROM businesses
              WHERE id = $1 AND status = 'activo'
              LIMIT 1
              `,
              [id]
            );

          if (!business.rows.length) {
            sendJson(res, 404, {
              error:
                "Local no disponible.",
            });
            return;
          }

          const videoFile = req.file;
          const visitorKey =
            getRequestVisitorKey(
              req,
              req.body?.visitorKey,
            );
          const videoSeconds =
            Number(
              req.body
                ?.videoDurationSeconds
            );

          if (!videoFile) {
            sendJson(res, 400, {
              error:
                "Debes grabar una resena en video.",
            });
            return;
          }

          if (
            !isAllowedReviewVideo(
              videoFile
            )
          ) {
            sendJson(res, 400, {
              error:
                "La resena debe ser video MP4, WEBM o MOV.",
            });
            return;
          }

          if (
            videoFile.size >
            REVIEW_VIDEO_MAX_BYTES
          ) {
            sendJson(res, 400, {
              error:
                "La resena no debe superar 25 MB.",
            });
            return;
          }

          if (
            !Number.isFinite(
              videoSeconds
            ) ||
            Math.abs(
              videoSeconds -
                REVIEW_VIDEO_SECONDS
            ) >
              REVIEW_VIDEO_TOLERANCE_SECONDS
          ) {
            sendJson(res, 400, {
              error:
                "La resena debe durar 15 segundos.",
            });
            return;
          }

          const uploadedReview =
            await uploadToCloudinary(
              videoFile,
              {
                resource_type:
                  "video",
                folder:
                  "parchar/reviews",
              }
            );

          const expiresAtSql =
            USE_POSTGRES
              ? "NOW() + INTERVAL '15 days'"
              : "datetime('now', '+15 days')";

          await pool.query(
            `
            INSERT INTO business_reviews (
              business_id,
              visitor_key,
              video_path,
              video_seconds,
              status,
              expires_at
            )
            VALUES (
              $1,$2,$3,$4,'activa',${expiresAtSql}
            )
            `,
            [
              id,
              visitorKey,
              uploadedReview.secure_url,
              Number(
                videoSeconds.toFixed(
                  2
                )
              ),
            ]
          );

          sendJson(res, 201, {
            ok: true,
            message:
              "Resena publicada por 15 dias.",
          });
          return;
        }

        if (
          pathname ===
            "/api/social/reviews" &&
          req.method === "GET"
        ) {
          const reviews =
            await pool.query(`
              SELECT
                r.id,
                r.business_id,
                r.video_path,
                r.video_seconds,
                r.expires_at,
                r.created_at,
                b.business_name,
                b.category,
                b.city,
                b.address,
                COALESCE((
                  SELECT COUNT(*)
                  FROM business_parches p
                  WHERE p.business_id = b.id
                ), 0) AS parchar_count
              FROM business_reviews r
              JOIN businesses b
                ON b.id = r.business_id
              WHERE
                r.status = 'activa'
                AND r.expires_at > CURRENT_TIMESTAMP
                AND b.status = 'activo'
              ORDER BY r.created_at DESC
              LIMIT 60
            `);

          sendJson(res, 200, {
            items: reviews.rows,
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
          const items =
            result.rows;

          for (const item of items) {
            const parches =
              await pool.query(
                `
                SELECT COUNT(*) AS count
                FROM business_parches
                WHERE business_id = $1
                `,
                [item.id]
              );

            const reviews =
              await pool.query(
                `
                SELECT
                  id,
                  video_path,
                  video_seconds,
                  expires_at,
                  created_at
                FROM business_reviews
                WHERE
                  business_id = $1
                  AND status = 'activa'
                  AND expires_at > CURRENT_TIMESTAMP
                ORDER BY created_at DESC
                LIMIT 3
                `,
                [item.id]
              );

            item.parchar_count =
              Number(
                parches.rows[0]
                  ?.count || 0
              );
            item.active_reviews =
              reviews.rows;
          }

          sendJson(res, 200, {
            items:
              items,
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
