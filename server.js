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
const ALLOWED_CATEGORIES =
  new Set([
    "moto",
    "carro",
    "romantico",
    "bbb",
  ]);

const MIME_TYPES = {
  ".css":
    "text/css; charset=utf-8",
  ".html":
    "text/html; charset=utf-8",
  ".ico":
    "image/x-icon",
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

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

function cleanText(value) {
  return String(
    value || ""
  ).trim();
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

  res.writeHead(200, {
    "Content-Type":
      contentType,
  });
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

async function uploadToCloudinary(
  file,
  options
) {
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

async function initializeDatabase() {
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
    ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL;
  `);

  await pool.query(`
    UPDATE businesses b
    SET client_id = c.id
    FROM clients c
    WHERE
      b.client_id IS NULL
      AND LOWER(b.owner_email) = LOWER(c.email);
  `);

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
            app: "parchar-v7",
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
            videoSeconds < 10 ||
            videoSeconds > 13
          ) {
            sendJson(res, 400, {
              error:
                "El video debe durar entre 10 y 13 segundos.",
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
          pathname.match(
            /^\/api\/admin\/businesses\/\d+\/approve$/
          ) &&
          req.method === "POST"
        ) {
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
  });
