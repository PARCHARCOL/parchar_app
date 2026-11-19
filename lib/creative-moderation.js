const { createHash, randomUUID } = require("node:crypto");
const sharp = require("sharp");
const CATEGORIES = ["harassment", "harassment/threatening", "hate", "hate/threatening", "illicit", "illicit/violent", "self-harm", "self-harm/intent", "self-harm/instructions", "sexual", "sexual/minors", "violence", "violence/graphic"];
const normalize = (text) => String(text || "").normalize("NFKD").replace(/[\u0300-\u036f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, "").toLowerCase();
function localChecks(creation) {
  const text = normalize(`${creation.alias} ${creation.title||""} ${creation.text}`), reasons = [];
  if (/https?:|www\.|(?:[a-z0-9-]+\.)+(?:com|co|net|org|io|app|xyz)\b/i.test(text)) reasons.push("Enlace o promoción externa");
  if (/[\w.+-]+\s*@\s*[\w.-]+\s*\.[a-z]{2,}/i.test(text)) reasons.push("Posible correo personal");
  if (/(?:\+?\d[\s().-]*){7,}/.test(text)) reasons.push("Posible teléfono, identificación o cuenta");
  if (/\b(?:calle|carrera|avenida|transversal|diagonal|cra|cl)\s*\d+[^\n]{0,30}(?:#|numero|nro)/.test(text)) reasons.push("Posible dirección particular");
  if (/(.)\1{9,}/u.test(text) || /(.{5,})\1{3,}/u.test(text)) reasons.push("Texto repetitivo o spam");
  if (/\b(?:te voy a matar|voy a matarte|maten a|hay que matar a|violarte|te voy a violar)\b/.test(text)) reasons.push("Amenaza o violencia dirigida");
  if (/\b(?:idiota|imbecil|maricon|puto|puta|malparido|hijueputa|gonorrea)\b/.test(text)) reasons.push("Lenguaje que requiere contexto humano");
  if (/\b(?:menor|nino|nina|infantil|bebe)\b/.test(text) && /\b(?:sexual|porno|desnud[oa]|sexo|violar)\b/.test(text)) reasons.push("Protección de menores: revisión humana restringida, sin envío externo");
  return [...new Set(reasons)];
}
function fingerprint(creation) {
  return createHash("sha256").update(JSON.stringify({ text: normalize(creation.text).replace(/\s+/g, " ").trim(), title:creation.title,parentId:creation.parentId,background: creation.background, strokes: creation.strokes })).digest("hex");
}
async function rasterize(creation) {
  const paths = creation.strokes.map((s) => {
    const points = s.points.map(([x, y]) => `${(x * 800).toFixed(2)},${(y * 600).toFixed(2)}`).join(" ");
    if (s.points.length === 1) return `<circle cx="${s.points[0][0] * 800}" cy="${s.points[0][1] * 600}" r="${s.width / 2}" fill="${s.color}"/>`;
    return `<polyline points="${points}" fill="none" stroke="${s.color}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="${creation.background}"/>${paths}</svg>`;
  return sharp(Buffer.from(svg), { limitInputPixels: 800 * 600 }).resize(512, 384).png().toBuffer();
}
function classifyResponse(data, threshold = 0.2) {
  const result = data?.results?.[0];
  if (typeof data?.model !== "string" || typeof result?.flagged !== "boolean" || !CATEGORIES.every((key) => typeof result.categories?.[key] === "boolean" && Number.isFinite(result.category_scores?.[key]) && result.category_scores[key] >= 0 && result.category_scores[key] <= 1)) throw new Error("invalid_response");
  const reasons = CATEGORIES.filter((key) => result.categories[key] || result.category_scores[key] >= threshold);
  const severe = ["sexual/minors", "hate/threatening", "harassment/threatening", "violence/graphic", "illicit/violent"].some((key) => result.categories[key] && result.category_scores[key] >= 0.9);
  return { status: severe ? "retirado" : result.flagged || reasons.length ? "pendiente" : "activo", reasons, model: data.model, scores: result.category_scores };
}
function createCreativeModeration({ pool, fetchImpl = fetch, env = process.env, render = rasterize, now = () => Date.now() }) {
  let running = false, timer;
  const configured = () => Boolean(env.OPENAI_API_KEY?.trim()) && env.WALL_AI_MODERATION !== "off";
  async function init() {
    await pool.query("CREATE TABLE IF NOT EXISTS creative_moderation (post_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, state TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_at TEXT NOT NULL, updated_at TEXT NOT NULL, lease TEXT, decision TEXT NOT NULL)");
    await pool.query("CREATE INDEX IF NOT EXISTS creative_moderation_queue ON creative_moderation(state, next_at)");
    await pool.query("CREATE INDEX IF NOT EXISTS creative_moderation_hash ON creative_moderation(fingerprint)");
    timer = setInterval(() => drain().catch(() => {}), 15000); timer.unref();
  }
  async function duplicate(author, creation) {
    const result = await pool.query("SELECT p.id FROM creative_posts p JOIN creative_moderation m ON m.post_id=p.id WHERE p.author_id=$1 AND m.fingerprint=$2 AND p.status<>$3 AND p.created_at>$4 LIMIT 1", [author, fingerprint(creation), "retirado", new Date(now() - 86400000).toISOString()]);
    return result.rows.length > 0;
  }
  async function enqueue(id, creation, disclosed) {
    const reasons = localChecks(creation);
    const stamp = new Date(now()).toISOString();
    const state = reasons.length || !disclosed ? "manual" : "queued";
    await pool.query("INSERT INTO creative_moderation (post_id,fingerprint,state,attempts,next_at,updated_at,decision) VALUES ($1,$2,$3,0,$4,$5,$6)", [id, fingerprint(creation), state, stamp, stamp, JSON.stringify({ reasons: reasons.length ? reasons : !disclosed ? ["Cliente anterior: requiere revisión manual"] : [], status: "pendiente", source: "local" })]);
    if (configured() && state === "queued") setImmediate(() => drain().catch(() => {}));
  }
  async function drain() {
    if (running || !configured()) return;
    running = true;
    try {
      const stamp = new Date(now()).toISOString();
      await pool.query("UPDATE creative_moderation SET state=$1 WHERE state=$2 AND updated_at<$3", ["queued", "processing", new Date(now() - 120000).toISOString()]);
      for (let i = 0; i < 4; i++) {
        const jobs = await pool.query("SELECT m.*,p.payload FROM creative_moderation m JOIN creative_posts p ON p.id=m.post_id WHERE m.state=$1 AND m.next_at<=$2 AND p.status=$3 ORDER BY m.next_at ASC LIMIT 1", ["queued", stamp, "pendiente"]);
        const job = jobs.rows[0]; if (!job) break;
        const lease = randomUUID();
        await pool.query("UPDATE creative_moderation SET state=$1,lease=$2,updated_at=$3 WHERE post_id=$4 AND state=$5", ["processing", lease, new Date(now()).toISOString(), job.post_id, "queued"]);
        const claim = await pool.query("SELECT lease FROM creative_moderation WHERE post_id=$1", [job.post_id]);
        if (claim.rows[0]?.lease !== lease) continue;
        try {
          const creation = JSON.parse(job.payload);
          const image = await render(creation);
          const response = await fetchImpl("https://api.openai.com/v1/moderations", { method: "POST", headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(20000), body: JSON.stringify({ model: "omni-moderation-latest", input: [{ type: "text", text: `${creation.alias}\n${creation.title ? creation.title+"\n" : ""}${creation.text}` }, { type: "image_url", image_url: { url: `data:image/png;base64,${image.toString("base64")}` } }] }) });
          if (!response.ok) throw new Error(`provider_${response.status}`);
          const value = Number(env.WALL_MODERATION_REVIEW_THRESHOLD || 0.2);
          const decision = classifyResponse(await response.json(), Number.isFinite(value) ? Math.max(0.05, Math.min(0.8, value)) : 0.2);
          const date = new Date(now()).toISOString();
          await pool.query("UPDATE creative_moderation SET state=$1,decision=$2,updated_at=$3 WHERE post_id=$4 AND lease=$5", ["done", JSON.stringify({ ...decision, source: "openai", policy: 1 }), date, job.post_id, lease]);
          // Human decisions, ownership removals and account blocks always win over late AI results.
          await pool.query("UPDATE creative_posts SET status=$1,reviewed_by=$2,reviewed_at=$3 WHERE id=$4 AND status=$5 AND reviewed_at IS NULL AND NOT EXISTS (SELECT 1 FROM creative_blocks b WHERE b.author_id=creative_posts.author_id) AND EXISTS (SELECT 1 FROM creative_moderation m WHERE m.post_id=creative_posts.id AND m.lease=$6)", [decision.status, "IA OpenAI / política 1", date, job.post_id, "pendiente", lease]);
        } catch (error) {
          const attempts = Number(job.attempts) + 1;
          const code = /^provider_\d+$/.test(error.message) ? error.message : error.message === "invalid_response" ? "invalid_response" : "analysis_unavailable";
          await pool.query("UPDATE creative_moderation SET state=$1,attempts=$2,next_at=$3,updated_at=$4,decision=$5 WHERE post_id=$6 AND lease=$7", [attempts >= 3 ? "manual" : "queued", attempts, new Date(now() + attempts * 60000).toISOString(), new Date(now()).toISOString(), JSON.stringify({ source: "openai", status: "pendiente", reasons: ["No se pudo completar el análisis automático"], error: code }), job.post_id, lease]);
        }
      }
    } finally { running = false; }
  }
  async function decision(id) { const result = await pool.query("SELECT state,decision FROM creative_moderation WHERE post_id=$1", [id]); return result.rows[0] ? { ...JSON.parse(result.rows[0].decision), state: result.rows[0].state } : { state: "manual", reasons: ["Publicación anterior a los filtros automáticos"] }; }
  async function summary() {
    const counts = await pool.query("SELECT COUNT(*) AS pending,MAX(created_at) AS latest FROM creative_posts WHERE status=$1", ["pendiente"]);
    const reports = await pool.query("SELECT COUNT(*) AS reports,MAX(r.created_at) AS latest FROM creative_reports r JOIN creative_posts p ON p.id=r.post_id WHERE p.status=$1 AND (p.reviewed_at IS NULL OR r.created_at>p.reviewed_at)", ["activo"]);
    return { configured: configured(), pending: Number(counts.rows[0]?.pending || 0), reports: Number(reports.rows[0]?.reports || 0), latestPending: counts.rows[0]?.latest || "", latestReport: reports.rows[0]?.latest || "" };
  }
  return { init, duplicate, enqueue, drain, decision, summary, close: () => clearInterval(timer) };
}
module.exports = { createCreativeModeration, localChecks, fingerprint, rasterize, classifyResponse, CATEGORIES };
