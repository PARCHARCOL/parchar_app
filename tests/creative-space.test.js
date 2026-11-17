const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs");
const space = require("../public/creative-space");

test("3D sectors stream a bounded neighborhood at negative and distant positions", () => {
  for (const coordinate of [-1000000, -32000, 0, 32000, 1000000]) {
    const sectors = space.chunks(coordinate, -coordinate);
    assert.equal(sectors.length, 25); assert.equal(new Set(sectors.map((tile) => tile.key)).size, 25);
    assert.deepEqual(space.chunks(coordinate, -coordinate), sectors);
    assert.ok(Number.isFinite(space.height(coordinate, -coordinate)));
  }
  assert.equal(space.chunks(0, 0, 1).length, 9);
});
test("mythical beings keep world-space separation and do not occupy publications", () => {
  const posts = [{ x: 0, y: 0 }, { x: 360, y: 0 }, { x: -360, y: 360 }];
  for (const x of [-6400, 0, 6400]) {
    const beings = space.beings(x, x, posts); assert.ok(beings.length <= 10 && beings.length > 0);
    for (const [i, being] of beings.entries()) {
      assert.equal(space.nearPost(being.x, being.z, posts, 180), false);
      for (const other of beings.slice(i + 1)) assert.ok(Math.hypot(being.x - other.x, being.z - other.z) >= 440);
    }
  }
});
test("vegetation is distributed beyond the center and reserves clearings", () => {
  const posts = [{ x: 0, y: 0 }];
  for (const x of [-32000, 0, 32000]) {
    const plants = space.plants(x, x, posts); assert.ok(plants.length > 20 && plants.length <= 320);
    assert.ok(plants.every((plant) => !space.nearPost(plant.x, plant.z, posts)));
    const creatures = space.beings(x, x, posts);
    assert.ok(plants.every((plant) => creatures.every((being) => Math.hypot(plant.x - being.x, plant.z - being.z) >= 115)));
  }
});
test("public queries use stable sectors rather than one request per gesture", () => {
  assert.deepEqual(space.queryBounds(160, 165), space.queryBounds(170, 175));
  assert.notDeepEqual(space.queryBounds(160, 165), space.queryBounds(1600, 165));
  assert.ok(space.queryBounds(1e12, -1e12).w <= 12000);
});
test("slow devices reduce detail then stop 3D instead of running indefinitely", () => {
  const state = { low: false, slow: 0, fallback: false };
  for (let i = 0; i < 30; i++) space.observeBudget(state, 55, true);
  assert.equal(state.low, true); assert.equal(state.fallback, false);
  for (let i = 0; i < 60; i++) space.observeBudget(state, 85, true);
  assert.equal(state.fallback, true);
  const stable = { low: false, slow: 0, fallback: false };
  for (let i = 0; i < 1000; i++) space.observeBudget(stable, 16.7, true);
  assert.equal(stable.low, false); assert.equal(stable.fallback, false);
  space.observeBudget(stable, 5000, false); assert.equal(stable.slow, 0);
});
test("3D is lazy, absent from home and not precached with the application shell", () => {
  const home = fs.readFileSync(require.resolve("../public/index.html"), "utf8");
  const worker = fs.readFileSync(require.resolve("../public/service-worker.js"), "utf8");
  const loader = fs.readFileSync(require.resolve("../public/creative-3d.js"), "utf8");
  assert.doesNotMatch(home, /creative-3d|creative-world-3d|three/);
  assert.doesNotMatch(worker, /creative-world-3d\.module/);
  assert.match(loader, /import\("\/creative-world-3d\.module/);
});
