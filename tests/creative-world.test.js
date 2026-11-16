const test = require("node:test");
const assert = require("node:assert/strict");
const { planTiles, planCreatures, creaturePoint } = require("../public/creative-world");
const map = { width: 1536, height: 1024, tileSize: 256, levels: [0, 1, 2, 3].map((id) => ({ id, density: 2 ** (id - 3), width: 1536 * 2 ** (id - 3), height: 1024 * 2 ** (id - 3) })), creatures: Array.from({ length: 24 }, (_, i) => ({ id: String(i), x: 0.2 + i % 6 * 0.12, y: 0.2 + Math.floor(i / 6) * 0.18, size: 140 })) };
test("world chooses detail by scale and pixel density", () => {
  const view = { x: -200, y: -100, w: 400, h: 300 };
  assert.ok(planTiles(view, 0.12, 1, map).every((tile) => tile.key.startsWith("0/")));
  assert.ok(planTiles(view, 0.3, 2, map).every((tile) => tile.key.startsWith("3/")));
});
test("authored archipelago exists once and is not mirrored or repeated", () => {
  assert.ok(planTiles({ x: -300, y: -300, w: 600, h: 600 }, 1, 2, map).length > 0);
  for (const x of [-100000, -2500, 20000]) assert.deepEqual(planTiles({ x, y: x, w: 1200, h: 800 }, .4, 1, map), []);
  const tiles = planTiles({ x: -2000, y: -2000, w: 10000, h: 10000 }, 1, 2, map);
  assert.equal(tiles.length, 24);
  assert.ok(tiles.every((tile) => !tile.flipX && !tile.flipY));
});
test("partial tiles retain region dimensions and invalid views load nothing", () => {
  const tiles = planTiles({ x: -768, y: -512, w: 1535, h: 1023 }, 0.12, 1, map);
  assert.ok(tiles.some((t) => t.w === 1536 && t.h === 1024));
  assert.deepEqual(planTiles({ x: NaN, y: 0, w: 300, h: 300 }, 1, 1, map), []);
});
test("creatures are culled at distant zoom and each catalog creature can be focused", () => {
  assert.equal(planCreatures({ x: -1000, y: -1000, w: 2000, h: 2000 }, 0.2, map).length, 0);
  map.creatures.forEach((species, index) => {
    const point = creaturePoint(species, index % 3, 0, map);
    const visible = planCreatures({ x: point.x - 100, y: point.y - 100, w: 200, h: 200 }, 1, map);
    assert.ok(visible.some((item) => item.species.id === species.id), species.id);
  });
});
test("scene updates keep publication layers separate", () => {
  const fs = require("node:fs");
  const code = fs.readFileSync(require.resolve("../public/creative.js"), "utf8");
  assert.doesNotMatch(code, /world\.replaceChildren/);
  assert.match(code, /postsLayer\.replaceChildren/);
});

test("published world assets include every tile and 24 transparent creature cutouts", async () => {
  const fs = require("node:fs"), path = require("node:path"), sharp = require("sharp");
  const root = path.join(__dirname, "..", "public", "assets", "creative-world");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  assert.equal(manifest.creatures.length, 24);
  for (const level of manifest.levels) for (let y = 0; y < Math.ceil(level.height / 256); y++) for (let x = 0; x < Math.ceil(level.width / 256); x++) assert.ok(fs.existsSync(path.join(root, String(level.id), `${x}-${y}.webp`)));
  for (const species of manifest.creatures) {
    const metadata = await sharp(path.join(root, "beings", `${species.id}.webp`)).metadata();
    assert.equal(metadata.hasAlpha, true); assert.equal(metadata.width, 512);
  }
  const stats = await sharp(path.join(root, "world-master.webp")).stats();
  assert.ok(stats.channels.some((channel) => channel.stdev > 20));
});
