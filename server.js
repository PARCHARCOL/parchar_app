

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { Pool } = require("pg");

const PORT = Number(
  process.env.PORT || 8080
);

const ROOT_DIR = __dirname;

const PUBLIC_DIR = path.join(
  ROOT_DIR,
  "public"
);

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

  ".mp4":
    "video/mp4",

  ".mov":
    "video/quicktime",

  ".pdf":
    "application/pdf",

  ".png":
    "image/png",

  ".svg":
    "image/svg+xml",

  ".webm":
    "video/webm",
};

const ALLOWED_CATEGORIES =
  new Set([
    "moto",
    "carro",
    "romantico",
    "bbb",
  ]);

async function initializeDatabase() {

  await pool.query(`
    CREATE TABLE IF NOT EXISTS businesses (
      id SERIAL PRIMARY KEY,

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

  console.log(
    "✅ PostgreSQL inicializado"
  );
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
    !fs.existsSync(
      absolutePath
    )
  ) {

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

  fs.createReadStream(
    absolutePath
  ).pipe(res);
}

function cleanText(value) {

  return String(
    value || ""
  ).trim();
}

function readPublicPath(
  urlPathname
) {

  let safePath =
    urlPathname;

  if (safePath === "/") {

    safePath =
      "/index.html";
  }

  safePath =
    safePath.replace(
      /^\/+/,
      ""
    );

  return path.join(
    PUBLIC_DIR,
    safePath
  );
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
            result instanceof Error
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
              "Content-Type",

            "Access-Control-Allow-Methods":
              "GET,POST,OPTIONS",
          });

          res.end();

          return;
        }

        // HEALTH

        if (
          pathname ===
            "/api/health" &&
          req.method === "GET"
        ) {

          sendJson(res, 200, {
            ok: true,
            app: "parchar-v5",
          });

          return;
        }

        // CREAR NEGOCIO

        if (
          pathname ===
            "/api/businesses" &&
          req.method === "POST"
        ) {

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

          const body = req.body;

          const category =
            cleanText(
              body.category
            ).toLowerCase();

          if (
            !ALLOWED_CATEGORIES.has(
              category
            )
          ) {

            sendJson(res, 400, {
              error:
                "Categoria invalida",
            });

            return;
          }

          let videoUrl = "";
          let rutUrl = "";
          let commerceUrl = "";

          // VIDEO

          if (
            req.files?.video?.[0]
          ) {

            const uploadedVideo =
              await new Promise(
                (
                  resolve,
                  reject
                ) => {

                  cloudinary.uploader.upload_stream(
                    {
                      resource_type:
                        "video",

                      folder:
                        "parchar/videos",
                    },

                    (
                      error,
                      result
                    ) => {

                      if (error) {

                        reject(
                          error
                        );

                        return;
                      }

                      resolve(
                        result
                      );
                    }
                  ).end(
                    req.files
                      .video[0]
                      .buffer
                  );
                }
              );

            videoUrl =
              uploadedVideo.secure_url;
          }

          // RUT PDF

          if (
            req.files
              ?.rutDocument?.[0]
          ) {

            const uploadedRut =
              await new Promise(
                (
                  resolve,
                  reject
                ) => {

                  cloudinary.uploader.upload_stream(
                    {
                      resource_type:
                      "auto",

                      folder:
                      "parchar/rut",
                    },

                    (
                      error,
                      result
                    ) => {

                      if (error) {

                        reject(
                          error
                        );

                        return;
                      }

                      resolve(
                        result
                      );
                    }
                  ).end(
                    req.files
                      .rutDocument[0]
                      .buffer
                  );
                }
              );

            rutUrl =
              uploadedRut.secure_url;
          }
          // CAMARA COMERCIO PDF

          if (
            req.files
              ?.commerceDocument?.[0]
          ) {

            const uploadedCommerce =
              await new Promise(
                (
                  resolve,
                  reject
                ) => {

                  cloudinary.uploader.upload_stream(
                    {
                      resource_type:
                      "auto",

                      folder:
                      "parchar/commerce",

                      },
                    (
                      error,
                      result
                    ) => {

                      if (error) {

                        reject(
                          error
                        );

                        return;
                      }

                      resolve(
                        result
                      );
                    }
                  ).end(
                    req.files
                      .commerceDocument[0]
                      .buffer
                  );
                }
              );

            commerceUrl =
              uploadedCommerce.secure_url;
          }






// VALIDAR DUPLICADOS

const duplicated =
  await pool.query(
    `
    SELECT id
    FROM businesses
    WHERE
      LOWER(business_name) = LOWER($1)
      OR owner_phone = $2
    LIMIT 1
    `,
    [
      cleanText(
        body.businessName
      ),

      cleanText(
        body.ownerPhone
      ),
    ]
  );

if (
  duplicated.rows.length
) {

  sendJson(res, 400, {
    error:
      "Este negocio ya fue registrado.",
  });

  return;
}







          await pool.query(
            `
            INSERT INTO businesses (
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
              $1,$2,$3,$4,$5,$6,$7,$8,$9,
              $10,$11,$12,$13,$14,$15,$16,
              $17,$18,$19
            )
          `,
            [
              cleanText(
                body.ownerName
              ),

              cleanText(
                body.ownerEmail
              ),

              cleanText(
                body.ownerPhone
              ),

              cleanText(
                body.ownerDocument
              ),

              cleanText(
                body.businessName
              ),

              category,

              cleanText(
                body.description
              ),

              cleanText(
                body.products
              ),

              cleanText(
                body.address
              ),

              cleanText(
                body.city
              ),

              Number(
                body.latitude
              ),

              Number(
                body.longitude
              ),

              cleanText(
                body.socialLink ||
                  ""
              ),

              rutUrl,

              commerceUrl,

              Boolean(
                body.legalAcceptance
              ),

              videoUrl,

              Number(
                body.videoDurationSeconds ||
                  10
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

        // ADMIN LISTA

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

        // APROBAR

        if (
          pathname.match(
            /^\/api\/admin\/businesses\/\d+\/approve$/
          ) &&
          req.method ===
            "POST"
        ) {

          const id =
            pathname.split("/")[4];

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





// RECHAZAR

if (
  pathname.match(
    /^\/api\/admin\/businesses\/\d+\/reject$/
  ) &&
  req.method ===
    "POST"
) {

  const id =
    pathname.split("/")[4];

  const body =
    await parseJsonBody(
      req
    );

  const reason =
    cleanText(
      body.reason
    );

  const businessResult =
    await pool.query(
      `
      SELECT *
      FROM businesses
      WHERE id = $1
    `,
      [id]
    );

  const business =
    businessResult.rows[0];

  console.log(`
    📧 EMAIL RECHAZO

    Negocio:
    ${business.business_name}

    Correo:
    ${business.owner_email}

    Motivo:
    ${reason}
  `);

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
    message:
      "Negocio rechazado",
  });

  return;
}

// PAUSAR

if (
  pathname.match(
    /^\/api\/admin\/businesses\/\d+\/pause$/
  ) &&
  req.method ===
    "POST"
) {

  const id =
    pathname.split("/")[4];

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

// ACTIVAR

if (
  pathname.match(
    /^\/api\/admin\/businesses\/\d+\/activate$/
  ) &&
  req.method ===
    "POST"
) {

  const id =
    pathname.split("/")[4];

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

       




        // ELIMINAR

        if (
          pathname.match(
            /^\/api\/admin\/businesses\/\d+\/delete$/
          ) &&
          req.method ===
            "POST"
        ) {

          const id =
            pathname.split("/")[4];

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

// NEGOCIOS APROBADOS

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


        // PUBLIC

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
            "Ruta no encontrada",
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
        `🔥 Parchar V5 corriendo en puerto ${PORT}`
      );
    });
  })
  .catch((error) => {

    console.error(
      "❌ Error inicializando DB",
      error
    );
  });
