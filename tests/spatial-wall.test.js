const test = require("node:test"),
  assert = require("node:assert/strict"),
  { DatabaseSync } = require("node:sqlite"),
  { randomUUID } = require("node:crypto");
const {
    createCreativeWall,
    normalizeCreation,
  } = require("../lib/creative-wall"),
  { editionWindow } = require("../lib/spatial-rules"),
  { localChecks } = require("../lib/creative-moderation");
const valid = (extra = {}) => ({
  format: "spatial-v1",
  title: "Un plan para conversar",
  text: "Compartamos una idea para descubrir el barrio.",
  alias: "Parcero",
  topic: "planes",
  depth: 50,
  city: "Medellín",
  lifetime: "permanent",
  avatar: "violeta",
  background: "#18112c",
  strokes: [],
  ...extra,
});
async function setup(t) {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  let editionQueries = 0;
  const pool = {
    async query(sql, values = []) {
      if (sql.startsWith("SELECT r.*")) editionQueries++;
      const bind = [];
      const statement = db.prepare(
        sql.replace(/\$(\d+)/g, (_, n) => {
          bind.push(values[Number(n) - 1]);
          return "?";
        }),
      );
      if (/^\s*SELECT/i.test(sql))
        return { rows: statement.all(...bind) };
      statement.run(...bind);
      return { rows: [] };
    },
  };
  const wall = createCreativeWall({
    pool,
    sendJson: (res, status, data) => Object.assign(res, { status, data }),
    parseJsonBody: async (req) => req.body,
    requireClientAuth: async (req, res) => {
      if (!req.author) {
        Object.assign(res, { status: 401, data: { error: "Inicia sesión" } });
        return null;
      }
      return { client: { id: req.author } };
    },
    moderation: {
      init: async () => {},
      duplicate: async () => false,
      enqueue: async () => {},
      decision: async () => null,
      summary: async () => ({ pending: 0, reports: 0, configured: false }),
    },
  });
  await wall.init();
  const call = async (
    path = "",
    { method = "GET", body = {}, author = 1, role = "admin" } = {},
  ) => {
    const res = {};
    await wall.handle(
      { method, body, author },
      res,
      new URL(
        `http://localhost${path.startsWith("/api") ? path : "/api/creative" + path}`,
      ),
      { staff: { role, username: "staff" } },
    );
    return res;
  };
  const make = async (body = valid(), author = 1) => {
    const res = await call("", { method: "POST", body, author });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    return res.data.id;
  };
  const approve = async (id) => {
    assert.equal(
      (
        await call(`/api/admin/creative/${id}/moderate`, {
          method: "POST",
          body: { action: "aprobar" },
        })
      ).status,
      200,
    );
  };
  return { db, call, make, approve, editionQueries: () => editionQueries };
}
test("spatial fields are bounded and expiration is computed by the server", () => {
  const creation = normalizeCreation(
    valid({ lifetime: "2h", expiresAt: "2099-01-01" }),
  );
  assert.ok(
    Math.abs(Date.parse(creation.expiresAt) - Date.now() - 7200000) < 1000,
  );
  for (const extra of [
    { depth: -1 },
    { depth: 101 },
    { topic: "unknown" },
    { lifetime: "forever" },
    { city: "arbitrary" },
    { title: "x".repeat(101) },
    { text: "x".repeat(4001) },
  ])
    assert.throws(() => normalizeCreation(valid(extra)));
  assert.equal(
    normalizeCreation(valid({ text: "x".repeat(1000) })).text.length,
    1000,
  );
  assert.ok(localChecks(valid({ title: "te voy a matar" })).length);
});
test("Bogota editions cross midnight consistently and archive has no daily window", () => {
  const night = editionWindow("night", Date.parse("2026-11-20T08:00:00Z"));
  assert.equal(night.start, "2026-11-19T23:00:00.000Z");
  assert.equal(night.end, "2026-11-20T11:00:00.000Z");
  const morning = editionWindow("morning", Date.parse("2026-11-20T17:00:00Z"));
  assert.equal(morning.start, "2026-11-20T11:00:00.000Z");
  assert.equal(editionWindow("archive").start, null);
  assert.throws(() => editionWindow("other"));
});
test("spatial nodes still require moderation and never expose popularity counters", async (t) => {
  const { call, make, approve } = await setup(t),
    id = await make();
  assert.equal((await call("/edition?period=archive")).data.items.length, 0);
  await approve(id);
  const edition = (await call("/edition?period=archive")).data;
  assert.equal(edition.items[0].id, id);
  assert.equal(edition.items[0].topic, "planes");
  assert.equal(Object.hasOwn(edition.items[0], "likes"), false);
  assert.equal(Object.hasOwn(edition.items[0], "author_id"), false);
});
test("context notes are validated, moderated, anchored and counted by distinct participants", async (t) => {
  const { call, make, approve } = await setup(t),
    parent = await make();
  await approve(parent);
  const noteBody = valid({
    kind: "note",
    parentId: parent,
    title: "Nota",
    text: "Me gusta esa pregunta",
    anchor: { x: 0.4, y: 0.5, quote: "Compartamos", start: 0 },
  });
  assert.equal(
    (
      await call("", {
        method: "POST",
        author: 2,
        body: { ...noteBody, anchor: { ...noteBody.anchor, start: 3 } },
      })
    ).status,
    400,
  );
  const note = await make(noteBody, 2);
  assert.equal((await call(`/${parent}/notes`)).data.items.length, 0);
  await approve(note);
  const publicNotes = (await call(`/${parent}/notes`)).data.items;
  assert.equal(publicNotes[0].anchor.start, 0);
  assert.equal(publicNotes[0].text, noteBody.text);
  const edition = (await call("/edition?period=archive")).data.items;
  assert.equal(edition.length, 1);
  assert.equal(edition[0].contributions, 1);
  assert.equal((await call("?view=list")).data.items.length, 1);
});
test("echoes are idempotent and private, capsules belong only to the authenticated user", async (t) => {
  const { call, make, approve } = await setup(t),
    id = await make();
  await approve(id);
  assert.equal(
    (
      await call(`/${id}/echo`, {
        method: "POST",
        author: 0,
        body: { kind: "think", active: true },
      })
    ).status,
    401,
  );
  for (let n = 0; n < 2; n++)
    assert.equal(
      (
        await call(`/${id}/echo`, {
          method: "POST",
          author: 2,
          body: { kind: "think", active: true, client_id: 99 },
        })
      ).status,
      200,
    );
  await call(`/${id}/echo`, {
    method: "POST",
    author: 2,
    body: { kind: "capsule", active: true },
  });
  assert.equal((await call("/personal", { author: 1 })).data.thanks.think, 1);
  assert.equal(
    (await call("/personal", { author: 3 })).data.thanks.think,
    undefined,
  );
  assert.equal(
    (await call("/personal", { author: 2 })).data.capsules[0].id,
    id,
  );
  assert.equal(
    (await call("/personal", { author: 3 })).data.capsules.length,
    0,
  );
  await call(`/${id}/echo`, {
    method: "POST",
    author: 2,
    body: { kind: "think", active: false },
  });
  assert.equal(
    (await call("/personal", { author: 1 })).data.thanks.think,
    undefined,
  );
});
test("expired or removed parents disappear from editions, legacy lists and interactions", async (t) => {
  const { call, make, approve, db } = await setup(t),
    id = await make();
  await approve(id);
  db.prepare(
    "UPDATE creative_spatial_meta SET expires_at=? WHERE post_id=?",
  ).run("2000-01-01T00:00:00.000Z", id);
  assert.equal((await call("/edition?period=archive")).data.items.length, 0);
  assert.equal((await call("?view=list")).data.items.length, 0);
  assert.equal((await call(`/${id}/notes`)).status, 404);
  assert.equal(
    (
      await call(`/${id}/echo`, {
        method: "POST",
        author: 2,
        body: { kind: "think", active: true },
      })
    ).status,
    404,
  );
});
test("finite editions balance island capacity and coalesce simultaneous public requests", async (t) => {
  const { db, call, editionQueries } = await setup(t),
    post = db.prepare(
      "INSERT INTO creative_posts(id,author_id,slot,x,y,payload,status,created_at) VALUES(?,?,?,?,?,?,?,?)",
    ),
    meta = db.prepare(
      "INSERT INTO creative_spatial_meta(post_id,kind,title,topic,depth,city,lifetime) VALUES(?,?,?,?,?,?,?)",
    );
  for (let i = 0; i < 70; i++) {
    const id = randomUUID(),
      topic = i < 60 ? "planes" : "arte";
    post.run(
      id,
      1,
      i,
      0,
      0,
      JSON.stringify(valid({ topic })),
      "activo",
      new Date().toISOString(),
    );
    meta.run(id, "node", "Título", topic, 50, "Medellín", "permanent");
  }
  const reads = await Promise.all(
    Array.from({ length: 100 }, () => call("/edition?period=archive")),
  );
  assert.equal(editionQueries(), 1);
  assert.equal(
    reads[0].data.items.filter((p) => p.topic === "planes").length,
    12,
  );
  assert.equal(
    reads[0].data.items.filter((p) => p.topic === "arte").length,
    10,
  );
});
