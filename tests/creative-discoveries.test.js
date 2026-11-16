const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const terrain = require("../public/creative-terrain");

test("terrain is stable across visits but distinct across distant coordinates", () => {
  const original = terrain.sample(225, -176);
  assert.deepEqual(terrain.sample(225, -176), original);
  const signatures = new Set();
  for (let i = 0; i < 1000; i++) signatures.add(JSON.stringify(terrain.sample(i * 1536 + 225, i * -1024 - 176)));
  assert.equal(signatures.size, 1000);
  assert.notDeepEqual(terrain.sample(225 + 1536, -176), original);
});
test("terrain stays continuous at boundaries including negative coordinates", () => {
  for (const x of [-4096, -1024, 0, 512, 2048, 64000]) {
    assert.ok(Math.abs(terrain.sample(x - .001, 110).height - terrain.sample(x + .001, 110).height) < .0001);
  }
});
test("terrain painter produces opaque varied pixels and a different distant region", () => {
  function raster(x, y) {
    let pixels;
    const context = { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: (image) => { pixels = image.data; }, beginPath() {}, ellipse() {}, fill() {} };
    terrain.paint({ getContext: () => context }, { x, y, size: 512 });
    return pixels;
  }
  const first = raster(0, 0), distant = raster(64000, -28000);
  assert.equal(first.length, 128 * 128 * 4);
  assert.ok(first.every((value, i) => i % 4 !== 3 || value === 255));
  assert.ok(new Set(first.filter((_, i) => i % 4 === 1)).size > 25);
  assert.notDeepEqual(first, distant);
});
test("terrain visible work is bounded at overview and close zoom", () => {
  for (const scale of [.12, .25, .65, 1.2, 2.5]) {
    const tiles = terrain.tiles({ x: -100000, y: 35000, w: 1280 / scale + 200, h: 850 / scale + 200 }, scale);
    assert.ok(tiles.length > 0 && tiles.length <= 96);
    assert.equal(new Set(tiles.map((t) => t.key)).size, tiles.length);
  }
  assert.deepEqual(terrain.tiles({ x: NaN, y: 0, w: 500, h: 500 }, 1), []);
});
test("closer zoom reveals additional landscape objects, not only enlarged pixels", () => {
  const view = { x: -1000, y: -1000, w: 2000, h: 2000 };
  assert.equal(terrain.landmarks(view, .2).length, 0);
  const far = terrain.landmarks(view, .65), near = terrain.landmarks(view, 1.3);
  assert.ok(far.length > 0 && near.length > far.length);
  assert.ok(far.every((item) => near.some((detail) => detail.key === item.key)));
  assert.ok(near.some((item) => !far.some((old) => old.key === item.key)));
});
test("organic discoveries use safe text, stable objects and keyboard-accessible buttons", () => {
  const createElement = (tag) => ({ tag, dataset: {}, children: [], attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, append(...children) { this.children.push(...children); } });
  const context = { window: {}, document: { createElement } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../public/creative-render.js"), "utf8"), context);
  const item = { id: "abc-123", alias: "Visitante", text: "<img src=x onerror=alert(1)> Un mensaje entre las flores", strokes: [] };
  const node = context.window.CreativeRender.discovery(item);
  assert.equal(node.tag, "button"); assert.equal(node.type, "button"); assert.equal(node.dataset.open, item.id);
  assert.equal(node.dataset.found, "false"); assert.match(node.attrs["aria-label"], /Visitante/);
  assert.match(node.children[0].src, /discoveries\/[012]\.webp$/);
  assert.equal(node.children[1].tag, "span"); assert.match(node.children[1].textContent, /^<img/);
  assert.equal(node.children[1].innerHTML, undefined);
  assert.equal(context.window.CreativeRender.discovery(item, true).dataset.found, "true");
  assert.equal(context.window.CreativeRender.discovery(item).children[0].src, node.children[0].src);
});
test("discovery sprites preserve transparency and have real image content", async () => {
  const sharp = require("sharp");
  for (let i = 0; i < 6; i++) {
    const file = path.join(__dirname, "../public/assets/creative-world/discoveries", `${i}.webp`);
    const info = await sharp(file).metadata(), stats = await sharp(file).stats();
    assert.equal(info.hasAlpha, true); assert.equal(info.width, 512);
    assert.equal(stats.channels[3].min, 0); assert.ok(stats.channels[3].max > 200);
    assert.ok(stats.channels[0].stdev > 20);
  }
});
