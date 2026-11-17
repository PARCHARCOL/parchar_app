const { randomUUID } = require("node:crypto");
const COLORS = ["#18112c", "#ffffff", "#36e5d0", "#ffcc58", "#f252ae", "#57aaff"];
const AVATARS = ["turquesa", "rosa", "dorado", "azul", "violeta"];
function normalizeCreation(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("La creación no es válida.");
  const text = String(body.text || "").trim();
  const alias = String(body.alias || "").trim();
  if (!alias || alias.length > 24 || text.length > 280) throw new Error("Escribe un nombre de hasta 24 caracteres y un mensaje de hasta 280.");
  if (!COLORS.includes(body.background) || !AVATARS.includes(body.avatar)) throw new Error("Selecciona un fondo y un avatar válidos.");
  if (!Array.isArray(body.strokes) || body.strokes.length > 120) throw new Error("El dibujo supera el límite de trazos.");
  let points = 0;
  const strokes = body.strokes.map((stroke) => {
    if (!stroke || typeof stroke !== "object") throw new Error("El dibujo contiene un trazo inválido.");
    if (!COLORS.includes(stroke.color) || !Number.isFinite(stroke.width) || stroke.width < 1 || stroke.width > 30 || !Array.isArray(stroke.points) || !stroke.points.length) throw new Error("El dibujo contiene un trazo inválido.");
    points += stroke.points.length;
    if (points > 3000) throw new Error("El dibujo es demasiado complejo. Simplifica algunos trazos.");
    return { color: stroke.color, width: stroke.width, points: stroke.points.map((p) => {
      if (!Array.isArray(p) || p.length !== 2 || !p.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) throw new Error("El dibujo tiene coordenadas inválidas.");
      return p;
    }) };
  });
  if (!text && !strokes.length) throw new Error("Escribe un mensaje o dibuja antes de publicar.");
  return { text, alias, background: body.background, avatar: body.avatar, strokes };
}
function slotPosition(n) {
  if (!n) return { x: 0, y: 0 };
  const ring = Math.ceil((Math.sqrt(n + 1) - 1) / 2), side = ring * 2;
  let d = (ring * 2 + 1) ** 2 - 1 - n;
  const edge = Math.floor(d / side); d %= side;
  const xy = [[ring - d, -ring], [-ring, -ring + d], [-ring + d, ring], [ring, ring - d]][edge];
  return { x: xy[0] * 360, y: xy[1] * 360 };
}
function viewportBounds(params) {
  const values = ["x", "y", "w", "h"].map((key, i) => Number(params.get(key) ?? (i < 2 ? -1500 : 3000)));
  if (!values.every(Number.isFinite) || values.slice(0, 2).some((n) => Math.abs(n) > 1000000) || values.slice(2).some((n) => n <= 0 || n > 12000)) throw new Error("Acércate a una zona del mural para cargar sus publicaciones.");
  return { x: values[0], y: values[1], w: values[2], h: values[3] };
}
function createCreativeWall({ pool, sendJson, parseJsonBody, requireClientAuth, moderation }) {
  const publicCache = require("./creative-read-cache").createCreativeReadCache();
  moderation ||= require("./creative-moderation").createCreativeModeration({ pool });
  let queue = Promise.resolve();
  const serialized = (fn) => { const result = queue.then(fn); queue = result.catch(() => {}); return result; };
  async function init() {
    await pool.query("CREATE TABLE IF NOT EXISTS creative_posts (id TEXT PRIMARY KEY, author_id INTEGER NOT NULL, slot INTEGER UNIQUE NOT NULL, x REAL NOT NULL, y REAL NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, reviewed_by TEXT, reviewed_at TEXT)");
    await pool.query("CREATE INDEX IF NOT EXISTS creative_posts_view ON creative_posts(status, x, y)");
    await pool.query("CREATE INDEX IF NOT EXISTS creative_posts_author ON creative_posts(author_id, created_at)");
    await pool.query("CREATE INDEX IF NOT EXISTS creative_posts_recent ON creative_posts(status, created_at)");
    await pool.query("CREATE TABLE IF NOT EXISTS creative_reports (post_id TEXT NOT NULL, author_id INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (post_id, author_id))");
    await pool.query("CREATE TABLE IF NOT EXISTS creative_reactions (post_id TEXT NOT NULL, author_id INTEGER NOT NULL, PRIMARY KEY (post_id, author_id))");
    await pool.query("CREATE TABLE IF NOT EXISTS creative_blocks (author_id INTEGER PRIMARY KEY, created_at TEXT NOT NULL)");
    await moderation.init();
  }
  function expose(row, internal = false) {
    return { id: row.id, x: Number(row.x), y: Number(row.y), ...JSON.parse(row.payload), createdAt: row.created_at, likes: Number(row.likes || 0), ...(internal ? { status: row.status, reports: Number(row.reports || 0), reasons: row.reasons || "" } : {}) };
  }
  async function handle(req, res, url, staffAuth) {
    const base = url.pathname.startsWith("/api/admin/") ? "/api/admin/creative" : "/api/creative";
    const tail = url.pathname.slice(base.length);
    const isAdmin = base.includes("/admin/");
    try {
      if (isAdmin && !["admin", "asesor"].includes(staffAuth?.staff?.role)) return sendJson(res, 403, { error: "No tienes acceso a la moderación del muro." });
      if (req.method === "GET" && isAdmin && tail === "/summary") return sendJson(res, 200, await moderation.summary());
      if (req.method === "GET" && !isAdmin && tail === "/policy") {
        const info = await moderation.summary();
        return sendJson(res, 200, { automaticConfigured: info.configured, provider: "OpenAI", policyVersion: 1 });
      }
      if (req.method === "GET" && !tail && !isAdmin) {
        if (url.searchParams.get("view") === "list") {
          const before = Number(url.searchParams.get("before") || 2147483647);
          if (!Number.isInteger(before) || before < 0 || before > 2147483647) throw new Error("Selecciona una página válida.");
          const data = await publicCache.read(`list/${before}`, async () => {
            const rows = await pool.query("SELECT p.*, (SELECT COUNT(*) FROM creative_reactions r WHERE r.post_id=p.id) AS likes FROM creative_posts p WHERE p.status=$1 AND p.slot < $2 ORDER BY p.slot DESC LIMIT 41", ["activo", before]);
            const page = rows.rows.slice(0, 40);
            return { items: page.map((r) => expose(r)), more: rows.rows.length > 40, before: page.at(-1)?.slot };
          });
          return sendJson(res, 200, data);
        }
        const { x, y, w, h } = viewportBounds(url.searchParams);
        const near = url.searchParams.get("order") === "near";
        const data = await publicCache.read(`zone/${x}/${y}/${w}/${h}/${near}`, async () => {
          const order = near ? "p.x*p.x+p.y*p.y-2*p.x*$6-2*p.y*$7 ASC,p.created_at DESC" : "p.created_at DESC";
          const values = ["activo", x - 320, x + w, y - 300, y + h];
          if (near) values.push(x + w / 2, y + h / 2);
          const rows = await pool.query(`SELECT p.*, (SELECT COUNT(*) FROM creative_reactions r WHERE r.post_id=p.id) AS likes FROM creative_posts p WHERE p.status=$1 AND p.x >= $2 AND p.x <= $3 AND p.y >= $4 AND p.y <= $5 ORDER BY ${order} LIMIT 61`, values);
          return { items: rows.rows.slice(0, 60).map((r) => expose(r)), more: rows.rows.length > 60 };
        });
        return sendJson(res, 200, data);
      }
      if (req.method === "GET" && !tail && isAdmin) {
        const status = ["pendiente", "activo", "retirado"].includes(url.searchParams.get("status")) ? url.searchParams.get("status") : "pendiente";
        const rows = await pool.query("SELECT p.*, (SELECT COUNT(*) FROM creative_reports r WHERE r.post_id=p.id) AS reports FROM creative_posts p WHERE p.status=$1 ORDER BY reports DESC, p.created_at ASC LIMIT 100", [status]);
        const items = [];
        for (const row of rows.rows) {
          const reports = await pool.query("SELECT reason FROM creative_reports WHERE post_id=$1", [row.id]);
          items.push({ ...expose({ ...row, reasons: reports.rows.map((r) => r.reason).join(" · ") }, true), moderation: await moderation.decision(row.id) });
        }
        return sendJson(res, 200, { items });
      }
      if (isAdmin && req.method === "POST" && /^\/[a-f0-9-]{36}\/moderate$/.test(tail)) {
        const id = tail.split("/")[1], body = await parseJsonBody(req);
        if (!["aprobar", "retirar", "bloquear", "desbloquear"].includes(body.action)) throw new Error("Acción de moderación inválida.");
        return await serialized(async () => {
          const found = await pool.query("SELECT * FROM creative_posts WHERE id=$1", [id]);
          if (!found.rows.length) return sendJson(res, 404, { error: "Publicación no encontrada." });
          const author = found.rows[0].author_id;
          if (body.action === "desbloquear") {
            await pool.query("DELETE FROM creative_blocks WHERE author_id=$1", [author]);
          } else if (body.action === "bloquear") {
            await pool.query("INSERT INTO creative_blocks (author_id,created_at) VALUES ($1,$2) ON CONFLICT (author_id) DO NOTHING", [author, new Date().toISOString()]);
            await pool.query("UPDATE creative_posts SET status=$1,reviewed_by=$2,reviewed_at=$3 WHERE author_id=$4", ["retirado", staffAuth.staff.username, new Date().toISOString(), author]);
          } else {
            const blocked = await pool.query("SELECT author_id FROM creative_blocks WHERE author_id=$1", [author]);
            if (body.action === "aprobar" && blocked.rows.length) throw new Error("El autor está bloqueado en el muro.");
            await pool.query("UPDATE creative_posts SET status=$1,reviewed_by=$2,reviewed_at=$3 WHERE id=$4", [body.action === "aprobar" ? "activo" : "retirado", staffAuth.staff.username, new Date().toISOString(), id]);
          }
          sendJson(res, 200, { ok: true });
        });
      }
      if (isAdmin) return sendJson(res, 404, { error: "Acción no disponible." });
      const auth = await requireClientAuth(req, res);
      if (!auth) return;
      const author = Number(auth.client.id);
      if (req.method === "GET" && tail === "/mine") {
        const rows = await pool.query("SELECT * FROM creative_posts WHERE author_id=$1 ORDER BY created_at DESC LIMIT 40", [author]);
        return sendJson(res, 200, { items: rows.rows.map((r) => expose(r, true)) });
      }
      if (req.method === "POST" && !tail) {
        const body = await parseJsonBody(req);
        if (Buffer.byteLength(JSON.stringify(body)) > 100000) throw new Error("La creación es demasiado grande.");
        const creation = normalizeCreation(body);
        return await serialized(async () => {
          const blocked = await pool.query("SELECT author_id FROM creative_blocks WHERE author_id=$1", [author]);
          if (blocked.rows.length) return sendJson(res, 403, { error: "Tu cuenta no puede publicar en el muro." });
          const previous = await pool.query("SELECT created_at FROM creative_posts WHERE author_id=$1 ORDER BY created_at DESC LIMIT 5", [author]);
          if (previous.rows.length && Date.now() - Date.parse(previous.rows[0].created_at) < 60000 || previous.rows.filter((p) => Date.now() - Date.parse(p.created_at) < 3600000).length >= 5) return sendJson(res, 429, { error: "Espera un momento antes de volver a publicar. Máximo 5 creaciones por hora." });
          if (await moderation.duplicate(author, creation)) return sendJson(res, 409, { error: "Ya enviaste esta misma creación. Revisa Mis creaciones." });
          let saved;
          for (let attempt = 0; attempt < 3; attempt++) {
            const last = await pool.query("SELECT MAX(slot) AS last_slot FROM creative_posts");
            const slot = last.rows[0]?.last_slot == null ? 0 : Number(last.rows[0].last_slot) + 1;
            const { x, y } = slotPosition(slot), id = randomUUID();
            try {
              await pool.query("INSERT INTO creative_posts (id,author_id,slot,x,y,payload,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [id, author, slot, x, y, JSON.stringify(creation), "pendiente", new Date(Date.now() + attempt).toISOString()]);
              saved = id; break;
            } catch (e) { if (!/unique/i.test(e.message) || attempt === 2) throw e; }
          }
          await moderation.enqueue(saved, creation, body.moderationConsent === true);
          sendJson(res, 201, { id: saved, status: "pendiente", message: "Creación recibida. Superará los filtros antes de publicarse; los casos dudosos pasan a revisión humana." });
        });
      }
      const match = tail.match(/^\/([a-f0-9-]{36})\/(report|like|delete)$/);
      if (req.method === "POST" && match) {
        const [, id, action] = match, body = await parseJsonBody(req);
        return await serialized(async () => {
          const rows = await pool.query("SELECT * FROM creative_posts WHERE id=$1", [id]);
          const post = rows.rows[0];
          if (!post || (post.status !== "activo" && !(action === "delete" && Number(post.author_id) === author))) return sendJson(res, 404, { error: "Publicación no disponible." });
          if (action === "delete") {
            if (Number(post.author_id) !== author) return sendJson(res, 403, { error: "Solo puedes retirar tus propias creaciones." });
            await pool.query("UPDATE creative_posts SET status=$1 WHERE id=$2", ["retirado", id]);
          } else if (action === "report") {
            if (!["Acoso", "Contenido ofensivo", "Datos personales", "Publicidad no autorizada", "Otro"].includes(body.reason)) throw new Error("Selecciona el motivo del reporte.");
            await pool.query("INSERT INTO creative_reports (post_id,author_id,reason,created_at) VALUES ($1,$2,$3,$4) ON CONFLICT (post_id,author_id) DO NOTHING", [id, author, body.reason, new Date().toISOString()]);
          } else {
            if (body.liked === false) await pool.query("DELETE FROM creative_reactions WHERE post_id=$1 AND author_id=$2", [id, author]);
            else await pool.query("INSERT INTO creative_reactions (post_id,author_id) VALUES ($1,$2) ON CONFLICT (post_id,author_id) DO NOTHING", [id, author]);
          }
          sendJson(res, 200, { ok: true });
        });
      }
      sendJson(res, 404, { error: "Acción no disponible." });
    } catch (error) {
      if (/Escribe|Selecciona|dibujo|creación|Acción|Acércate|autor/.test(error.message)) sendJson(res, 400, { error: error.message });
      else { console.error("Muro creativo:", error); sendJson(res, 500, { error: "No pudimos completar la operación del muro." }); }
    } finally {
      if (req.method === "POST") publicCache.invalidate();
    }
  }
  return { init, handle };
}
module.exports = { createCreativeWall, normalizeCreation, slotPosition, viewportBounds, COLORS, AVATARS };
