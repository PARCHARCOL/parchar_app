const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs");
const space = require("../public/creative-space");
test("forest scale, bounded ground cover and a carved river remain coherent", () => {
  for(const p of space.plants(160,505)) { const d=space.dimensions(p); assert.ok(d.leaf<=d.tree*.26); assert.ok(d.fern<space.EYE_HEIGHT); assert.ok(d.flower<d.fern); }
  for(const low of [true,false]) {const cover=space.groundCover(160,505,[],low); assert.ok(cover.grass.length>300);assert.ok(cover.grass.length<=(low?600:1400));assert.ok(cover.rocks.length<=(low?24:60));assert.ok(cover.grass.every((p)=>p.size<=10));}
  for(let z=0;z<2400;z+=50){const r=space.river(z);assert.ok(space.height(r.x,z)<r.y);assert.ok(space.height(r.x+r.width+45,z)>r.y);}
  assert.equal(space.river(3000),null);
});
test("local time selects readable daytime, twilight and night skies",()=>{
  assert.equal(space.daylight(12).phase,"dia");assert.equal(space.daylight(18).phase,"crepusculo");assert.equal(space.daylight(23).phase,"noche");assert.equal(space.daylight(3).phase,"noche");assert.notEqual(space.daylight(12).horizon,space.daylight(23).horizon);
});

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
  const stalled = { low: false, slow: 0, fallback: false };
  for (let i = 0; i < 10; i++) space.observeBudget(stalled, 800, true);
  assert.equal(stalled.fallback, true);
});
test("3D is lazy, absent from home and not precached with the application shell", () => {
  const home = fs.readFileSync(require.resolve("../public/index.html"), "utf8");
  const worker = fs.readFileSync(require.resolve("../public/service-worker.js"), "utf8");
  const loader = fs.readFileSync(require.resolve("../public/creative-3d.js"), "utf8");
  assert.doesNotMatch(home, /creative-3d|creative-world-3d|three/);
  assert.doesNotMatch(worker, /creative-world-3d\.module/);
  assert.match(loader, /import\("\/creative-world-3d\.module/);
});
test("exploration stays at eye level and cannot orbit into an overhead view", () => {
  assert.ok(space.MIN_POLAR > 1.3); assert.ok(space.MAX_POLAR < 2.1);
  for (const [x,z] of [[160,505],[-2300,800],[32000,15000]]) assert.equal(space.eyeLevel(x,z) - Math.max(12,space.height(x,z)), space.EYE_HEIGHT);
  const levels = Array.from({length:60},(_,i)=>space.eyeLevel(160,i*80));
  assert.ok(levels.some((value,i)=>i>0 && value<levels[i-1]));
});
test("forest has a majority of trees, navigation clearings and volumetric waterfalls", () => {
  const plants=space.plants(160,505,[],2);
  assert.ok(plants.filter((p)=>p.kind===0).length>plants.length*.45);
  assert.ok(plants.every((p)=>Math.abs(((p.x-160+320)%640+640)%640-320)>=38));
  const falls=space.waterfalls(160,505); assert.ok(falls.some((f)=>f.key==='encuentro'));
  assert.ok(falls.every((f)=>f.height>=150 && f.width>=90));
  assert.ok(space.waterfalls(32000,15000).length<=3);
});
