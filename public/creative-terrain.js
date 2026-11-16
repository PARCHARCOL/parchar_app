(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CreativeTerrain = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  function hash(x, y, seed = 0) {
    let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed, 1274126177);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  function noise(x, y, size, seed) {
    x /= size; y /= size;
    const ix = Math.floor(x), iy = Math.floor(y);
    let u = x - ix, v = y - iy;
    u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
    const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed);
    const c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  }
  function sample(x, y) {
    const height = noise(x, y, 1900, 1) * .55 + noise(x, y, 650, 2) * .28 + noise(x, y, 170, 3) * .12 + noise(x, y, 38, 4) * .05;
    return { height, biome: noise(x, y, 2400, 17), river: Math.abs(noise(x, y, 800, 44) - .5) };
  }
  function tiles(view, scale) {
    if (![view.x, view.y, view.w, view.h, scale].every(Number.isFinite) || scale <= 0 || view.w <= 0 || view.h <= 0) return [];
    const size = scale < .25 ? 2048 : scale < .5 ? 1024 : scale < 1.1 ? 512 : 256;
    const result = [];
    for (let y = Math.floor(view.y / size); y <= Math.floor((view.y + view.h) / size); y++) {
      for (let x = Math.floor(view.x / size); x <= Math.floor((view.x + view.w) / size); x++) {
        result.push({ key: `${size}/${x}/${y}`, x: x * size, y: y * size, size });
      }
    }
    return result.sort((a, b) => Math.hypot(a.x - view.x - view.w / 2, a.y - view.y - view.h / 2) - Math.hypot(b.x - view.x - view.w / 2, b.y - view.y - view.h / 2)).slice(0, 96);
  }
  function landmarks(view, scale) {
    if (scale < .35) return [];
    const size = scale >= 1.1 ? 180 : 420, result = [];
    for (let iy = Math.floor(view.y / size) - 1; iy <= Math.floor((view.y + view.h) / size) + 1; iy++) {
      for (let ix = Math.floor(view.x / size) - 1; ix <= Math.floor((view.x + view.w) / size) + 1; ix++) {
        const x = (ix + .15 + hash(ix, iy, 50) * .7) * size, y = (iy + .15 + hash(ix, iy, 51) * .7) * size;
        if (sample(x, y).height < .38) continue;
        result.push({ key: `${size}/${ix}/${iy}`, x, y, kind: 3 + Math.floor(hash(ix, iy, 52) * 3), size: 90 + hash(ix, iy, 53) * (size === 180 ? 65 : 160) });
        if (result.length >= 100) return result;
      }
    }
    return result;
  }
  function paint(canvas, tile) {
    const pixels = 128;
    canvas.width = pixels; canvas.height = pixels;
    const ctx = canvas.getContext("2d", { alpha: false }), image = ctx.createImageData(pixels, pixels);
    for (let py = 0; py < pixels; py++) for (let px = 0; px < pixels; px++) {
      const x = tile.x + px * tile.size / pixels, y = tile.y + py * tile.size / pixels;
      const s = sample(x, y), h = s.height;
      const grain = (noise(x, y, 9, 66) - .5) * 30 + (noise(x, y, 31, 67) - .5) * 32;
      const slope = (noise(x - 10, y - 14, 170, 3) - noise(x + 10, y + 14, 170, 3)) * 90;
      const violet = Math.max(0, Math.min(1, (s.biome - .48) * 5));
      let color = [13 + violet * 51 + h * 16 + grain, 57 + h * 67 - violet * 32 + grain, 65 + violet * 49 + h * 46 + grain];
      const shore = Math.max(0, Math.min(1, (h - .35) / .045));
      const river = Math.max(0, Math.min(1, (s.river - .004) / .012));
      const land = shore * river;
      const depth = Math.max(0, Math.min(1, (h - .17) / .21));
      const water = [5 + depth * 20, 25 + depth * 93 + grain * .25, 53 + depth * 85 + grain * .3];
      color = color.map((channel, index) => channel * land + water[index] * (1 - land) + slope * land);
      const i = (py * pixels + px) * 4;
      image.data[i] = color[0]; image.data[i + 1] = color[1]; image.data[i + 2] = color[2]; image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    // Global coordinates keep rivers, shorelines and tiny plants continuous across tile edges.
    if (tile.size <= 512) {
      const step = 90, ratio = pixels / tile.size;
      for (let iy = Math.floor(tile.y / step); iy < Math.ceil((tile.y + tile.size) / step); iy++) for (let ix = Math.floor(tile.x / step); ix < Math.ceil((tile.x + tile.size) / step); ix++) {
        const x = (ix + hash(ix, iy, 70)) * step, y = (iy + hash(ix, iy, 71)) * step;
        if (sample(x, y).height < .39) continue;
        ctx.fillStyle = hash(ix, iy, 72) > .5 ? "#71ffe4aa" : "#f78ee9aa";
        ctx.beginPath(); ctx.ellipse((x - tile.x) * ratio, (y - tile.y) * ratio, 1, 2, hash(ix, iy) * 6, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  return { hash, noise, sample, tiles, landmarks, paint };
});
