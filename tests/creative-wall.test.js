const test = require("node:test");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const { createCreativeWall, normalizeCreation, slotPosition, viewportBounds } = require("../lib/creative-wall");
const valid = () => ({ text: "Mi primer parche", alias: "Parcero", avatar: "turquesa", background: "#18112c", strokes: [{ color: "#36e5d0", width: 6, points: [[0.1, 0.2], [0.8, 0.9]] }] });
test("mythical avatars are allowlisted and message positions are bounded dry land",()=>{
  assert.equal(normalizeCreation({...valid(),creatureAvatar:"dragon"}).creatureAvatar,"dragon");
  assert.throws(()=>normalizeCreation({...valid(),creatureAvatar:"../../private"}));
  for(const position of [{x:Infinity,y:0},{x:1e7,y:0},{x:"2",y:0},[]])assert.throws(()=>normalizeCreation({...valid(),position}));
  const r=require("../public/creative-space").river(500);
  assert.throws(()=>normalizeCreation({...valid(),position:{x:r.x-160,y:335}}));
});
test("chosen position and creature persist behind moderation and occupied places are rejected",async(t)=>{
  const {call,db}=await setup(t),space=require("../public/creative-space");
  let position;for(let x=1000;x<5000;x+=300)if(space.height(x+160,1165)>3){position={x,y:1000};break;}
  const made=await call("",{method:"POST",body:{...valid(),position,creatureAvatar:"fenix"}});
  assert.equal(made.status,201);const row=db.prepare("SELECT * FROM creative_posts").get();assert.equal(row.x,position.x);assert.equal(row.y,position.y);assert.equal(row.status,"pendiente");assert.equal(JSON.parse(row.payload).creatureAvatar,"fenix");
  assert.equal((await call("",{method:"POST",author:2,body:{...valid(),position}})).status,409);
  assert.equal((await call()).data.items.length,0);
});
async function setup(t) {
  const db = new DatabaseSync(":memory:"); t.after(() => db.close());
  let publicQueries = 0;
  const pool = { async query(sql, values = []) { if (sql.includes("p.status=$1 AND p.x")) publicQueries++; const s = db.prepare(sql.replace(/\$\d+/g, "?")); if (/^\s*(SELECT|WITH)/i.test(sql)) return { rows: s.all(...values) }; s.run(...values); return { rows: [] }; } };
  const wall = createCreativeWall({ pool, sendJson: (res, status, data) => { res.status = status; res.data = data; }, parseJsonBody: async (req) => req.body, requireClientAuth: async (req, res) => { if (!req.author) { res.status = 401; res.data = {}; return null; } return { client: { id: req.author, fullName: "Private name" } }; } });
  await wall.init();
  const call = async (path = "", { method = "GET", body = {}, author = 1, role = "admin" } = {}) => { const res = {}; await wall.handle({ method, body, author }, res, new URL(`http://localhost${path.startsWith("/api") ? path : `/api/creative${path}`}`), { staff: { role, username: "moderador" } }); return res; };
  return { db, call, publicQueries: () => publicQueries };
}

test("1000 simultaneous public wall reads share one SELECT and moderation invalidates it", async (t) => {
  const { call, publicQueries } = await setup(t);
  const id = (await call("", { method: "POST", body: valid() })).data.id;
  await call(`/api/admin/creative/${id}/moderate`, { method: "POST", body: { action: "aprobar" } });
  const responses = await Promise.all(Array.from({ length: 1000 }, () => call("?x=-2048&y=-2048&w=5120&h=5120")));
  assert.equal(publicQueries(), 1); assert.ok(responses.every((response) => response.data.items[0].id === id));
  assert.ok(responses.every((response) => response.data.items[0].author_id === undefined));
  await call(`/api/admin/creative/${id}/moderate`, { method: "POST", body: { action: "retirar" } });
  assert.equal((await call("?x=-2048&y=-2048&w=5120&h=5120")).data.items.length, 0);
  assert.equal(publicQueries(), 2);
});
test("dense 3D zones preserve nearby older messages instead of only returning newest ones", async (t) => {
  const { call, db } = await setup(t);
  const id = (await call("", { method: "POST", body: valid() })).data.id;
  await call(`/api/admin/creative/${id}/moderate`, { method: "POST", body: { action: "aprobar" } });
  const insert = db.prepare("INSERT INTO creative_posts (id,author_id,slot,x,y,payload,status,created_at) VALUES (?,?,?,?,?,?,?,?)");
  for (let i = 1; i <= 80; i++) insert.run(`dense-${i}`, 2, i, 1800 + i, 1800, JSON.stringify(valid()), "activo", "2099-01-01T00:00:00Z");
  const query = "?x=-2048&y=-2048&w=5120&h=5120";
  assert.equal((await call(query)).data.items.some((item) => item.id === id), false);
  const near = (await call(query + "&order=near")).data;
  assert.equal(near.items[0].id, id); assert.equal(near.items.length, 60); assert.equal(near.more, true);
});
test("creative drawings reject invalid payloads and enforce stroke limits", () => {
  assert.deepEqual(normalizeCreation(valid()).strokes[0].points, [[0.1, 0.2], [0.8, 0.9]]);
  for (const data of [null, { ...valid(), strokes: [null] }, { ...valid(), background: "url(evil)" }, { ...valid(), avatar: "arbitrary" }, { ...valid(), alias: "a".repeat(25) }, { ...valid(), text: "a".repeat(281) }, { ...valid(), strokes: [{ color: "#ffffff", width: 4, points: [[Infinity, 0]] }] }, { ...valid(), strokes: [{ color: "#ffffff", width: 4, points: [[-1, 0]] }] }, { ...valid(), strokes: Array(121).fill(valid().strokes[0]) }, { ...valid(), strokes: [{ color: "#ffffff", width: 4, points: Array(3001).fill([0, 0]) }] }, { ...valid(), strokes: [], text: "" }]) assert.throws(() => normalizeCreation(data));
});
test("spatial slots do not overlap and viewport input is bounded", () => {
  const positions = new Set(Array.from({ length: 1000 }, (_, i) => JSON.stringify(slotPosition(i))));
  assert.equal(positions.size, 1000); assert.deepEqual(slotPosition(0), { x: 0, y: 0 });
  assert.equal(viewportBounds(new URLSearchParams("x=0&y=0&w=100&h=100")).w, 100);
  for (const query of ["x=NaN", "x=Infinity", "w=0", "h=12001", "x=1000001"]) assert.throws(() => viewportBounds(new URLSearchParams(query)));
});
test("publishing is authenticated, moderated, and never leaks private identity", async (t) => {
  const { call, db } = await setup(t);
  assert.equal((await call("", { method: "POST", body: valid(), author: 0 })).status, 401);
  const created = await call("", { method: "POST", body: { ...valid(), author_id: 99, status: "activo", x: 99999 } });
  assert.equal(created.status, 201); const id = created.data.id;
  assert.equal(db.prepare("SELECT author_id FROM creative_posts").get().author_id, 1);
  assert.equal((await call()).data.items.length, 0);
  assert.equal((await call("/api/admin/creative", { role: "publicidad" })).status, 403);
  assert.equal((await call(`/api/admin/creative/${id}/moderate`, { method: "POST", body: { action: "aprobar" } })).status, 200);
  const publicPost = (await call()).data.items[0];
  assert.equal(publicPost.id, id); assert.equal(publicPost.x, 0); assert.equal(publicPost.author_id, undefined); assert.equal(publicPost.reviewed_by, undefined); assert.equal(publicPost.status, undefined);
  assert.equal((await call(`/${id}/delete`, { method: "POST", author: 2 })).status, 403);
  assert.equal((await call()).data.items.length, 1);
});
test("reports and reactions are idempotent and blocking is reversible without automatic republication", async (t) => {
  const { call } = await setup(t);
  const id = (await call("", { method: "POST", body: valid() })).data.id;
  const moderate = (action) => call(`/api/admin/creative/${id}/moderate`, { method: "POST", body: { action } });
  await moderate("aprobar");
  for (let i = 0; i < 2; i++) await call(`/${id}/like`, { method: "POST", author: 2, body: { liked: true } });
  assert.equal((await call()).data.items[0].likes, 1);
  for (let i = 0; i < 2; i++) assert.equal((await call(`/${id}/report`, { method: "POST", author: 2, body: { reason: "Acoso" } })).status, 200);
  assert.equal((await call("/api/admin/creative?status=activo")).data.items[0].reports, 1);
  await moderate("bloquear"); assert.equal((await call()).data.items.length, 0);
  assert.equal((await call("", { method: "POST", body: valid() })).status, 403);
  assert.equal((await moderate("aprobar")).status, 400);
  await moderate("desbloquear"); assert.equal((await call()).data.items.length, 0);
  assert.equal((await moderate("aprobar")).status, 200);
  await call(`/${id}/delete`, { method: "POST" }); assert.equal((await call()).data.items.length, 0);
});
test("rate limit is persisted and list pagination keeps equal timestamps", async (t) => {
  const { call, db } = await setup(t);
  const first = await call("", { method: "POST", body: valid() });
  assert.equal((await call("", { method: "POST", body: valid() })).status, 429);
  const insert = db.prepare("INSERT INTO creative_posts (id,author_id,slot,x,y,payload,status,created_at) VALUES (?,?,?,?,?,?,?,?)");
  for (let i = 1; i < 45; i++) insert.run(`post-${i}`, 2, i, i * 360, 0, JSON.stringify(valid()), "activo", "2026-11-16T00:00:00.000Z");
  const page = (await call("?view=list")).data; assert.equal(page.items.length, 40); assert.equal(page.more, true);
  const next = (await call(`?view=list&before=${page.before}`)).data;
  assert.equal(next.items.length, 4); assert.equal(next.more, false);
  assert.equal(new Set([...page.items, ...next.items].map((p) => p.id)).size, 44);
  assert.equal((await call("?x=20000&y=20000&w=100&h=100")).data.items.length, 0);
  assert.equal((await call("/mine")).data.items[0].id, first.data.id);
});
