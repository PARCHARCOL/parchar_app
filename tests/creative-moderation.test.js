const test = require("node:test");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const sharp = require("sharp");
const { createCreativeModeration, localChecks, fingerprint, rasterize, classifyResponse, CATEGORIES } = require("../lib/creative-moderation");
const creation = () => ({ alias: "Parcero", text: "Un buen plan", background: "#18112c", strokes: [{ color: "#36e5d0", width: 15, points: [[0.1, 0.1], [0.9, 0.9]] }] });
function response(flagged = false, key = "violence", score = 0) { return { model: "omni-moderation-latest", results: [{ flagged, categories: Object.fromEntries(CATEGORIES.map((k) => [k, flagged && k === key])), category_scores: Object.fromEntries(CATEGORIES.map((k) => [k, k === key ? score : 0])) }] }; }
async function setup(t, fetchImpl = async () => ({ ok: true, json: async () => response() })) {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE creative_posts (id TEXT PRIMARY KEY,author_id INTEGER,payload TEXT,status TEXT,created_at TEXT,reviewed_at TEXT,reviewed_by TEXT); CREATE TABLE creative_blocks (author_id INTEGER); CREATE TABLE creative_reports (post_id TEXT,created_at TEXT)");
  const pool = { async query(sql, params = []) { const stmt = db.prepare(sql.replace(/\$\d+/g, "?")); if (/^SELECT/i.test(sql)) return { rows: stmt.all(...params) }; stmt.run(...params); return { rows: [] }; } };
  const env = {}; let clock = Date.parse("2026-11-16T12:00:00Z");
  const moderation = createCreativeModeration({ pool, env, fetchImpl, render: async () => Buffer.from("test-image"), now: () => clock });
  await moderation.init(); t.after(() => { moderation.close(); db.close(); });
  async function seed(id = "post-1", value = creation(), disclosed = true) { db.prepare("INSERT INTO creative_posts(id,author_id,payload,status,created_at) VALUES (?,1,?,'pendiente',?)").run(id, JSON.stringify(value), new Date(clock).toISOString()); await moderation.enqueue(id, value, disclosed); }
  return { db, env, moderation, seed, advance: () => { clock += 240000; } };
}
test("local filters route contacts, links, threats, spam and child-safety concerns to humans", () => {
  for (const text of ["https://example.com", "mi correo a@b.com", "llama al 300 123 4567", "calle 20 # 3", "aaaaaaaaaaaaa", "te voy a matar", "menor desnudo", "eres un idiota"]) assert.ok(localChecks({ alias: "P", text }).length, text);
  assert.equal(localChecks(creation()).length, 0);
  assert.equal(fingerprint(creation()), fingerprint({ ...creation(), alias: "Otro nombre" }));
});
test("server rasterizes validated strokes without accepting a client-supplied image", async () => {
  const image = await rasterize(creation());
  const metadata = await sharp(image).metadata(); assert.equal(metadata.width, 512); assert.equal(metadata.height, 384);
  const stats = await sharp(image).stats(); assert.ok(stats.channels.some((channel) => channel.max > channel.min));
});
test("model results are validated and ambiguous scores never approve", () => {
  assert.equal(classifyResponse(response()).status, "activo");
  assert.equal(classifyResponse(response(false, "violence", 0.21)).status, "pendiente");
  assert.equal(classifyResponse(response(true, "harassment", 0.7)).status, "pendiente");
  assert.equal(classifyResponse(response(true, "violence/graphic", 0.99)).status, "retirado");
  for (const bad of [{}, { model: "x", results: [{ flagged: false }] }, { ...response(), results: [] }]) assert.throws(() => classifyResponse(bad));
});
test("missing key, old clients and local flags never auto-publish or transmit", async (t) => {
  let calls = 0; const s = await setup(t, async () => { calls++; throw new Error(); });
  await s.seed(); await s.moderation.drain(); assert.equal(calls, 0);
  await s.seed("old", creation(), false); await s.seed("protected", { ...creation(), text: "menor desnudo" });
  assert.equal((await s.moderation.decision("old")).state, "manual");
  assert.equal((await s.moderation.decision("protected")).state, "manual");
  assert.equal(s.db.prepare("SELECT COUNT(*) AS n FROM creative_posts WHERE status='activo'").get().n, 0);
});
test("clean analysis publishes and sends only the public creation", async (t) => {
  let request; const s = await setup(t, async (url, options) => { request = { url, body: JSON.parse(options.body) }; return { ok: true, json: async () => response() }; });
  await s.seed(); s.env.OPENAI_API_KEY = "mock"; await s.moderation.drain();
  assert.equal(s.db.prepare("SELECT status FROM creative_posts").get().status, "activo");
  assert.equal(request.url, "https://api.openai.com/v1/moderations");
  assert.equal(request.body.input[0].text, "Parcero\nUn buen plan");
  assert.equal(request.body.input.length, 2); assert.equal(request.body.author_id, undefined);
  assert.equal((await s.moderation.decision("post-1")).source, "openai");
});
test("provider errors retry and fail closed after three attempts", async (t) => {
  let calls = 0; const s = await setup(t, async () => { calls++; return { ok: false, status: 429 }; });
  await s.seed(); s.env.OPENAI_API_KEY = "mock";
  for (let i = 0; i < 3; i++) { await s.moderation.drain(); s.advance(); }
  assert.equal(calls, 3); assert.equal((await s.moderation.decision("post-1")).state, "manual");
  assert.equal(s.db.prepare("SELECT status FROM creative_posts").get().status, "pendiente");
});
test("human removal while analysis runs cannot be reversed by AI", async (t) => {
  let s; s = await setup(t, async () => { s.db.prepare("UPDATE creative_posts SET status='retirado',reviewed_at=?").run(new Date().toISOString()); return { ok: true, json: async () => response() }; });
  await s.seed(); s.env.OPENAI_API_KEY = "mock"; await s.moderation.drain();
  assert.equal(s.db.prepare("SELECT status FROM creative_posts").get().status, "retirado");
});
test("summary includes pending submissions and only unresolved reports", async (t) => {
  const s = await setup(t); await s.seed();
  let info = await s.moderation.summary(); assert.equal(info.pending, 1); assert.equal(info.configured, false);
  s.db.prepare("UPDATE creative_posts SET status='activo',reviewed_at='2026-11-16T10:00:00Z'").run();
  s.db.prepare("INSERT INTO creative_reports VALUES ('post-1','2026-11-16T11:00:00Z')").run();
  assert.equal((await s.moderation.summary()).reports, 1);
  s.db.prepare("UPDATE creative_posts SET reviewed_at='2026-11-16T12:00:00Z'").run();
  assert.equal((await s.moderation.summary()).reports, 0);
});
