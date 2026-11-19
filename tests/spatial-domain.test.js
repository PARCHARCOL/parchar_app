const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const path = require("node:path");
const fs = require("node:fs");
const zlib = require("node:zlib");
const esbuild = require("esbuild");

const compiled = esbuild.buildSync({
  entryPoints: [path.join(__dirname, "../src/spatial-wall/domain.js")],
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
}).outputFiles[0].text;
const sandbox = { module: { exports: {} }, Intl, Date };
vm.runInNewContext(compiled, sandbox);
const domain = sandbox.module.exports;
const posts = Array.from({ length: 48 }, (_, i) => ({
  id: String(i),
  topic: domain.TOPICS[Math.floor(i / 12)].id,
  depth: (i % 5) * 25,
  city: i % 2 ? "Bello" : "Medellín",
  contributions: (i % 4) * 3,
}));

test("all finite-edition slots fit the board without overlapping, including organic card sizes", () => {
  const laidOut = domain.layoutPosts(posts);
  for (const a of laidOut) {
    assert.ok(
      a.x >= 0 &&
        a.y >= 0 &&
        a.x + a.width < domain.BOARD.width &&
        a.y + a.height < domain.BOARD.height,
    );
    for (const b of laidOut) {
      if (a.id === b.id) continue;
      assert.ok(
        a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y,
        `${a.id} overlaps ${b.id}`,
      );
    }
  }
  assert.ok(laidOut[3].width > laidOut[0].width);
});

test("filters hide nodes without repositioning them or changing the edition total", () => {
  const placed = domain.layoutPosts(posts),
    filtered = domain.filterPosts(placed, {
      city: "Bello",
      reach: 0,
      depth: 50,
    });
  assert.ok(filtered.length > 0 && filtered.length < placed.length);
  for (const post of filtered) {
    assert.equal(post.city, "Bello");
    assert.ok(post.depth >= 50);
    assert.equal(post.x, placed.find((p) => p.id === post.id).x);
  }
  assert.equal(placed.length, 48);
  assert.equal(
    domain.filterPosts(placed, { city: "Sabaneta", reach: 0, depth: 0 }).length,
    0,
  );
  assert.equal(
    domain.filterPosts(placed, { city: "Sabaneta", reach: 50, depth: 0 })
      .length,
    48,
  );
});

test("exploration is idempotent and bounded; expiration is respected", () => {
  let state = domain.nodeReducer([], { type: "visit", id: "a" });
  state = domain.nodeReducer(state, { type: "visit", id: "a" });
  assert.equal(state.length, 1);
  const now = Date.parse("2026-11-19T20:00:00Z");
  assert.equal(
    domain.lifeLabel(
      { createdAt: "2026-11-19T20:00:20Z", expiresAt: "2026-11-26T20:00:20Z" },
      now,
    ),
    "Expira en 7 días",
  );
  assert.equal(
    domain.lifeLabel({ expiresAt: "2026-11-19T20:15:00Z" }, now),
    "Expira en 15 min",
  );
  assert.equal(
    domain.lifeLabel({ expiresAt: "2026-11-19T19:00:00Z" }, now),
    "Finalizó",
  );
  assert.equal(
    domain.filterPosts(
      [{ ...posts[0], expiresAt: "2026-11-19T19:00:00Z" }],
      { reach: 100, depth: 0 },
      now,
    ).length,
    0,
  );
  assert.equal(domain.readLocal("unavailable", "fallback"), "fallback");
});

test("the deployed wall loads the 2D bundle without the old 3D runtime and compressed files match", () => {
  const publicPath = path.join(__dirname, "../public"),
    html = fs.readFileSync(path.join(publicPath, "creative.html"), "utf8"),
    sw = fs.readFileSync(path.join(publicPath, "service-worker.js"), "utf8");
  assert.match(html, /spatial-wall\.bundle\.js\?v=1/);
  assert.doesNotMatch(html, /creative-3d|creative-world|three|webgl/i);
  assert.match(sw, /spatial-wall\.bundle/);
  assert.doesNotMatch(sw, /"\/creative-3d\.js"/);
  const raw = fs.readFileSync(path.join(publicPath, "spatial-wall.bundle.js")),
    br = fs.readFileSync(path.join(publicPath, "spatial-wall.bundle.js.br")),
    gz = fs.readFileSync(path.join(publicPath, "spatial-wall.bundle.js.gz"));
  assert.deepEqual(zlib.brotliDecompressSync(br), raw);
  assert.deepEqual(zlib.gunzipSync(gz), raw);
  assert.ok(br.length < 100000, "Keep the wall bundle below 100KB Brotli");
});
