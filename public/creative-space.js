(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./creative-terrain") : root.CreativeTerrain);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CreativeSpace = api;
})(typeof window !== "undefined" ? window : globalThis, function (terrain) {
  const CHUNK = 640;
  function height(x, z) { return (terrain.sample(x * 3, z * 3).height - .34) * 180; }
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
    const result = [], creatures = beings(x, z, posts), step = 155;
    const reach = CHUNK * (radius + .5);
    for (let iz = Math.floor((z - reach) / step); iz <= Math.floor((z + reach) / step); iz++) for (let ix = Math.floor((x - reach) / step); ix <= Math.floor((x + reach) / step); ix++) {
      const px = (ix + .5 + (terrain.hash(ix, iz, 5) - .5) * .28) * step;
      const pz = (iz + .5 + (terrain.hash(ix, iz, 6) - .5) * .28) * step;
      const y = height(px, pz);
      if (y < 3 || nearPost(px, pz, posts) || creatures.some((c) => Math.hypot(c.x - px, c.z - pz) < 115)) continue;
      result.push({ x: px, z: pz, y, kind: Math.floor(terrain.hash(ix, iz, 7) * 3), size: .65 + terrain.hash(ix, iz, 8) * .65, hue: terrain.hash(ix, iz, 9) });
    }
    return result.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z)).slice(0, radius === 1 ? 140 : 320);
  }
  function queryBounds(x, z) {
    const left = Math.max(-990000, Math.min(990000, Math.floor(x / 1024) * 1024 - 2048));
    const top = Math.max(-990000, Math.min(990000, Math.floor(z / 1024) * 1024 - 2048));
    return { x: left, y: top, w: 5120, h: 5120 };
  }
  function observeBudget(state, frameMs, active) {
    if (!active || !Number.isFinite(frameMs) || frameMs > 1000) return state;
    const bad = frameMs > (state.low ? 45 : 34);
    state.slow = bad ? state.slow + 1 : Math.max(0, state.slow - 3);
    if (state.slow >= (state.low ? 60 : 30)) { if (state.low) state.fallback = true; else state.low = true; state.slow = 0; }
    return state;
  }
  return { CHUNK, height, chunks, beings, plants, nearPost, queryBounds, observeBudget };
});
