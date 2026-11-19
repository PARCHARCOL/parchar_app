const { editionWindow } = require("./spatial-rules");
function createSpatialWall({
  pool,
  sendJson,
  parseJsonBody,
  requireClientAuth,
  serialized,
  publicCache,
  now = () => Date.now(),
}) {
  async function init() {
    await pool.query(
      "CREATE TABLE IF NOT EXISTS creative_spatial_meta (post_id TEXT PRIMARY KEY, kind TEXT NOT NULL, parent_id TEXT, title TEXT NOT NULL, topic TEXT NOT NULL, depth INTEGER NOT NULL, city TEXT NOT NULL, lifetime TEXT NOT NULL, expires_at TEXT)",
    );
    await pool.query(
      "CREATE INDEX IF NOT EXISTS creative_spatial_parent ON creative_spatial_meta(parent_id,kind)",
    );
    await pool.query(
      "CREATE TABLE IF NOT EXISTS creative_spatial_signals (post_id TEXT NOT NULL, client_id INTEGER NOT NULL, kind TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(post_id,client_id,kind))",
    );
    await pool.query(
      "CREATE INDEX IF NOT EXISTS creative_spatial_signals_client ON creative_spatial_signals(client_id,created_at)",
    );
  }
  function expose(row) {
    const payload = JSON.parse(row.payload);
    return {
      id: row.id,
      alias: payload.alias,
      avatar: payload.avatar,
      creatureAvatar: payload.creatureAvatar,
      background: payload.background,
      strokes: payload.strokes,
      text: payload.text,
      title:
        row.title ||
        payload.title ||
        String(payload.text || "Una creación").slice(0, 65),
      topic: row.topic || "reflexiones",
      city: row.city || "",
      depth: Number(row.depth ?? 25),
      lifetime: row.lifetime || "permanent",
      expiresAt: row.expires_at || null,
      createdAt: row.created_at,
      contributions: Number(row.contributions || 0),
      anchor: payload.anchor,
    };
  }
  async function parent(id) {
    const rows = await pool.query(
      "SELECT p.*,m.expires_at,m.kind FROM creative_posts p LEFT JOIN creative_spatial_meta m ON m.post_id=p.id WHERE p.id=$1 AND p.status=$2",
      [id, "activo"],
    );
    const row = rows.rows[0];
    return row &&
      row.kind !== "note" &&
      (!row.expires_at || row.expires_at > new Date(now()).toISOString())
      ? row
      : null;
  }
  async function prepare(creation) {
    if (creation.kind !== "note") return;
    const post = await parent(creation.parentId);
    if (!post)
      throw new Error("La publicación de esta nota ya no está disponible.");
    const original = JSON.parse(post.payload).text || "";
    if (
      creation.anchor.start != null &&
      original.slice(
        creation.anchor.start,
        creation.anchor.start + creation.anchor.quote.length,
      ) !== creation.anchor.quote
    )
      throw new Error("Selecciona otra vez el fragmento de la nota.");
    if (
      post.expires_at &&
      (!creation.expiresAt || creation.expiresAt > post.expires_at)
    )
      creation.expiresAt = post.expires_at;
  }
  async function insert(id, creation) {
    if (creation.format !== "spatial-v1") return;
    await pool.query(
      "INSERT INTO creative_spatial_meta(post_id,kind,parent_id,title,topic,depth,city,lifetime,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        id,
        creation.kind,
        creation.parentId || null,
        creation.title,
        creation.topic,
        creation.depth,
        creation.city,
        creation.lifetime,
        creation.expiresAt,
      ],
    );
  }
  async function handle(req, res, url) {
    const tail = url.pathname.slice("/api/creative".length);
    if (req.method === "GET" && tail === "/edition") {
      const edition = editionWindow(
        url.searchParams.get("period") || "morning",
        now(),
      );
      const result = await publicCache.read(
        `edition/${edition.id}/${Math.floor(now() / 15000)}`,
        async () => {
          const values = ["activo", edition.asOf];
          let where = "";
          if (edition.period === "archive")
            where = " AND (m.lifetime='permanent' OR m.post_id IS NULL)";
          else {
            values.push(edition.start, edition.end);
            where = " AND p.created_at >= $3 AND p.created_at < $4";
          }
          const rows = await pool.query(
            `SELECT r.*,(SELECT COUNT(DISTINCT n.author_id) FROM creative_posts n JOIN creative_spatial_meta nm ON nm.post_id=n.id WHERE nm.parent_id=r.id AND n.status=$1 AND (nm.expires_at IS NULL OR nm.expires_at>$2)) AS contributions
             FROM (SELECT p.*,m.title,m.topic,m.depth,m.city,m.lifetime,m.expires_at,ROW_NUMBER() OVER(PARTITION BY COALESCE(m.topic,'reflexiones') ORDER BY p.slot DESC) AS topic_rank
                   FROM creative_posts p LEFT JOIN creative_spatial_meta m ON m.post_id=p.id
                   WHERE p.status=$1 AND (m.kind IS NULL OR m.kind='node') AND (m.expires_at IS NULL OR m.expires_at>$2)${where}) r
             WHERE r.topic_rank<=12 ORDER BY r.slot DESC LIMIT 48`,
            values,
          );
          return { edition, items: rows.rows.map(expose), more: false };
        },
      );
      sendJson(res, 200, result);
      return true;
    }
    const notes = tail.match(/^\/([a-f0-9-]{36})\/notes$/);
    if (req.method === "GET" && notes) {
      if (!(await parent(notes[1]))) {
        sendJson(res, 404, {
          error: "Esta publicación ya no está disponible.",
        });
        return true;
      }
      const rows = await pool.query(
        "SELECT p.*,m.title,m.topic,m.depth,m.city,m.lifetime,m.expires_at FROM creative_posts p JOIN creative_spatial_meta m ON m.post_id=p.id WHERE m.parent_id=$1 AND p.status=$2 AND (m.expires_at IS NULL OR m.expires_at>$3) ORDER BY p.created_at ASC LIMIT 80",
        [notes[1], "activo", new Date(now()).toISOString()],
      );
      sendJson(res, 200, { items: rows.rows.map(expose) });
      return true;
    }
    const signal = tail.match(/^\/([a-f0-9-]{36})\/echo$/);
    if (
      !(req.method === "GET" && tail === "/personal") &&
      !(req.method === "POST" && signal)
    )
      return false;
    const auth = await requireClientAuth(req, res);
    if (!auth) return true;
    const client = Number(auth.client.id);
    if (req.method === "GET") {
      const rows = await pool.query(
        "SELECT s.post_id,s.kind FROM creative_spatial_signals s WHERE s.client_id=$1 ORDER BY s.created_at DESC LIMIT 500",
        [client],
      );
      const capsules = await pool.query(
        "SELECT p.*,m.title,m.topic,m.depth,m.city,m.lifetime,m.expires_at FROM creative_spatial_signals s JOIN creative_posts p ON p.id=s.post_id LEFT JOIN creative_spatial_meta m ON m.post_id=p.id WHERE s.client_id=$1 AND s.kind='capsule' AND p.status=$2 AND (m.expires_at IS NULL OR m.expires_at>$3) ORDER BY s.created_at DESC LIMIT 100",
        [client, "activo", new Date(now()).toISOString()],
      );
      const thanks = await pool.query(
        "SELECT s.kind,COUNT(*) AS total FROM creative_spatial_signals s JOIN creative_posts p ON p.id=s.post_id WHERE p.author_id=$1 AND s.kind IN ('think','useful') GROUP BY s.kind",
        [client],
      );
      sendJson(res, 200, {
        signals: rows.rows.map((r) => ({ postId: r.post_id, kind: r.kind })),
        capsules: capsules.rows.map(expose),
        thanks: Object.fromEntries(
          thanks.rows.map((r) => [r.kind, Number(r.total)]),
        ),
      });
      return true;
    }
    const body = await parseJsonBody(req);
    if (
      !["think", "useful", "capsule"].includes(body.kind) ||
      typeof body.active !== "boolean"
    )
      throw new Error("Selecciona un agradecimiento válido.");
    return serialized(async () => {
      const post = await parent(signal[1]);
      if (!post) {
        sendJson(res, 404, {
          error: "Esta publicación ya no está disponible.",
        });
        return true;
      }
      const blocked = await pool.query(
        "SELECT author_id FROM creative_blocks WHERE author_id=$1",
        [client],
      );
      if (blocked.rows.length) {
        sendJson(res, 403, {
          error: "Tu cuenta no puede interactuar en el muro.",
        });
        return true;
      }
      if (body.kind !== "capsule" && Number(post.author_id) === client) {
        sendJson(res, 400, {
          error: "No puedes agradecer tu propia publicación.",
        });
        return true;
      }
      if (body.active)
        await pool.query(
          "INSERT INTO creative_spatial_signals(post_id,client_id,kind,created_at) VALUES($1,$2,$3,$4) ON CONFLICT(post_id,client_id,kind) DO NOTHING",
          [signal[1], client, body.kind, new Date(now()).toISOString()],
        );
      else
        await pool.query(
          "DELETE FROM creative_spatial_signals WHERE post_id=$1 AND client_id=$2 AND kind=$3",
          [signal[1], client, body.kind],
        );
      sendJson(res, 200, { ok: true });
      return true;
    });
  }
  return { init, handle, prepare, insert };
}
module.exports = { createSpatialWall };
