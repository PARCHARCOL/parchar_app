(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./creative-terrain") : root.CreativeTerrain);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CreativeSpace = api;
})(typeof window !== "undefined" ? window : globalThis, function (terrain) {
  const CHUNK = 640;
  function baseHeight(x, z) {
    const ridge = Math.max(0, .55 - terrain.noise(x, z, 1900, 112)) / .55;
    return (terrain.sample(x * 3, z * 3).height - .34) * 180 + ridge ** 2.4 * 1250;
  }
  function river(z) {
    if (z < -15 || z > 2400) return null;
    return { x: -20 + 65 * Math.sin((z + 15) / 250), y: baseHeight(-20, -15) + 4 - (z + 15) * .008, width: 42 + 8 * Math.sin(z / 180) };
  }
  function height(x, z) {
    const h = baseHeight(x, z), r = river(z);
    if (!r) return h;
    const d = Math.abs(x - r.x), bank = r.width + 45;
    if (d <= r.width) return r.y - 10;
    if (d < bank) return r.y - 10 + (d - r.width) / 45 * 18;
    const t = Math.min(1, (d - bank) / 45), smooth = t * t * (3 - 2 * t);
    return (r.y + 8) * (1 - smooth) + h * smooth;
  }
  function dimensions(p) {
    const tree = (155 + p.hue * 65) * (.9 + (p.size - .8) * .25);
    return { tree, leaf: tree * .25, fern: 18 + p.hue * 10, flower: 12 + p.hue * 6 };
  }
  function daylight(hour) {
    if (hour >= 7 && hour < 17) return { phase: "dia", top: "#247fb2", horizon: "#b8e4de", fog: "#6aabb5", light: 1 };
    if (hour >= 5 && hour < 7 || hour >= 17 && hour < 19) return { phase: "crepusculo", top: "#6151ac", horizon: "#c8c2ef", fog: "#72aaa9", light: 1 };
    return { phase: "noche", top: "#182d61", horizon: "#527e9f", fog: "#315774", light: .9 };
  }
  function groundCover(x, z, posts = [], low = false) {
    const grass = [], rocks = [], step = 28, reach = low ? 460 : 650;
    for (let iz = Math.floor((z - reach) / step); iz <= Math.floor((z + reach) / step); iz++) for (let ix = Math.floor((x - reach) / step); ix <= Math.floor((x + reach) / step); ix++) {
      const px = (ix + terrain.hash(ix, iz, 222)) * step, pz = (iz + terrain.hash(ix, iz, 223)) * step, r = river(pz);
      if (nearPost(px, pz, posts, 100) || r && Math.abs(px - r.x) < r.width + 5) continue;
      const point = { x: px, z: pz, y: height(px, pz), size: 5 + terrain.hash(ix, iz, 224) * 5, hue: terrain.hash(ix, iz, 225) };
      if (point.y < 3) continue;
      grass.push(point);
      if (terrain.hash(ix, iz, 226) < .035) rocks.push(point);
    }
    const near = (a,b) => Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z);
    return { grass: grass.sort(near).slice(0, low ? 600 : 1400), rocks: rocks.sort(near).slice(0, low ? 24 : 60) };
  }
  const EYE_HEIGHT = 34, MIN_POLAR = Math.PI * .44, MAX_POLAR = Math.PI * .64;
  function eyeLevel(x, z) { return Math.max(12, height(x, z)) + EYE_HEIGHT; }
  function waterfalls(x, z) {
    const result = [{ key: "encuentro", x: -20, z: -15, height: 190, width: 110 }];
    const cell = 1600;
    for (let iz = Math.floor(z / cell) - 1; iz <= Math.floor(z / cell) + 1; iz++) for (let ix = Math.floor(x / cell) - 1; ix <= Math.floor(x / cell) + 1; ix++) {
      const px = (ix + .5) * cell - 20, pz = (iz + .5) * cell - 15;
      if (Math.hypot(px + 20, pz + 15) < 1000) continue;
      result.push({ key: `${ix}/${iz}`, x: px, z: pz, height: 150 + terrain.hash(ix, iz, 92) * 120, width: 90 + terrain.hash(ix, iz, 93) * 55 });
    }
    return result.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z)).slice(0, 3);
  }
  function chunks(x, z, radius = 2) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK), list = [];
    for (let iz = cz - radius; iz <= cz + radius; iz++) for (let ix = cx - radius; ix <= cx + radius; ix++) list.push({ key: `${ix}/${iz}`, x: ix * CHUNK, z: iz * CHUNK, ix, iz });
    return list.sort((a, b) => Math.hypot(a.x + CHUNK / 2 - x, a.z + CHUNK / 2 - z) - Math.hypot(b.x + CHUNK / 2 - x, b.z + CHUNK / 2 - z));
  }
  function nearPost(x, z, posts, radius = 150) { return posts.some((post) => Math.hypot(post.x + 160 - x, post.y + 165 - z) < radius); }
  function faunaPoint(ix, iz, posts = []) {
    let x = (ix + .5) * CHUNK, z = (iz + .5) * CHUNK;
    for (const [dx, dz] of [[0, 0], [100, 0], [-100, 0], [0, 100], [0, -100]]) {
      if (!nearPost(x + dx, z + dz, posts, 180)) return { x: x + dx, z: z + dz };
    }
    return null;
  }
  function beings(x, z, posts = []) {
    return chunks(x, z).map((chunk) => {
      const point = faunaPoint(chunk.ix, chunk.iz, posts);
      const species = ((chunk.ix % 6 + 6) % 6) + ((chunk.iz % 4 + 4) % 4) * 6;
      return point && { ...point, key: chunk.key, species, y: Math.max(8, height(point.x, point.z)) };
    }).filter(Boolean).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z)).slice(0, 10);
  }
  function plants(x, z, posts = [], radius = 2) {
    const result = [], creatures = beings(x, z, posts), falls = waterfalls(x, z), step = 105;
    const reach = CHUNK * (radius + .5);
    for (let iz = Math.floor((z - reach) / step); iz <= Math.floor((z + reach) / step); iz++) for (let ix = Math.floor((x - reach) / step); ix <= Math.floor((x + reach) / step); ix++) {
      const px = (ix + .5 + (terrain.hash(ix, iz, 5) - .5) * .28) * step;
      const pz = (iz + .5 + (terrain.hash(ix, iz, 6) - .5) * .28) * step;
      const y = height(px, pz);
      const r = river(pz); if (r && Math.abs(px - r.x) < r.width + 30) continue;
      if (y < 3 || nearPost(px, pz, posts) || creatures.some((c) => Math.hypot(c.x - px, c.z - pz) < 115) || falls.some((f) => Math.hypot(f.x - px, f.z - pz) < 115)) continue;
      const kind = terrain.hash(ix, iz, 7);
      const lane = Math.abs(((px - 160 + CHUNK / 2) % CHUNK + CHUNK) % CHUNK - CHUNK / 2);
      if (lane < 38) continue;
      result.push({ x: px, z: pz, y, kind: kind < .62 && lane >= 75 ? 0 : kind < .9 ? 1 : 2, size: .8 + terrain.hash(ix, iz, 8) * .6, hue: terrain.hash(ix, iz, 9) });
    }
    return result.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z)).slice(0, radius === 1 ? 100 : 260);
  }
  function queryBounds(x, z) {
    const left = Math.max(-990000, Math.min(990000, Math.floor(x / 1024) * 1024 - 2048));
    const top = Math.max(-990000, Math.min(990000, Math.floor(z / 1024) * 1024 - 2048));
    return { x: left, y: top, w: 5120, h: 5120, order: "near" };
  }
  function viewpoint(x, z, posts = []) {
    const nearby = plants(x, z, posts, 1);
    const choices = [[0,340],[-65,340],[65,340],[-130,340],[130,340],[0,270],[0,410]];
    const [dx,dz] = choices.find(([dx,dz]) => nearby.every((plant) => Math.hypot(plant.x - x - dx, plant.z - z - dz) > (plant.kind === 0 ? 65 : 24))) || choices[0];
    return { x: x + dx, z: z + dz };
  }
  function observeBudget(state, frameMs, active) {
    if (!active || !Number.isFinite(frameMs) || frameMs > 1000) return state;
    const bad = frameMs > (state.low ? 45 : 34);
    state.slow = bad ? state.slow + Math.min(10, Math.max(1, Math.floor(frameMs / 80))) : Math.max(0, state.slow - 3);
    if (state.slow >= (state.low ? 60 : 30)) { if (state.low) state.fallback = true; else state.low = true; state.slow = 0; }
    return state;
  }
  return { CHUNK, height, river, dimensions, daylight, groundCover, EYE_HEIGHT, MIN_POLAR, MAX_POLAR, eyeLevel, viewpoint, waterfalls, chunks, beings, plants, nearPost, queryBounds, observeBudget };
});
