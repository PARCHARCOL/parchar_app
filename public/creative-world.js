(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./creative-terrain") : root.CreativeTerrain);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CreativeWorld = api;
})(typeof window !== "undefined" ? window : globalThis, function (terrainEngine) {
  function planTiles(view, scale, dpr, map) {
    if (![view.x, view.y, view.w, view.h, scale, dpr].every(Number.isFinite) || scale <= 0 || view.w <= 0 || view.h <= 0) return [];
    const target = scale * Math.min(2, Math.max(1, dpr));
    const level = map.levels.find((item) => item.density >= target) || map.levels.at(-1);
    const density = level.density, size = map.tileSize, result = [];
    const left = Math.floor((view.x + map.width / 2) / map.width), right = Math.floor((view.x + view.w + map.width / 2) / map.width);
    const top = Math.floor((view.y + map.height / 2) / map.height), bottom = Math.floor((view.y + view.h + map.height / 2) / map.height);
    // The authored archipelago exists once. Other coordinates use continuous seeded terrain.
    for (let ry = top; ry <= bottom; ry++) for (let rx = left; rx <= right; rx++) {
      if (rx !== 0 || ry !== 0) continue;
      const flipX = Math.abs(rx % 2) === 1, flipY = Math.abs(ry % 2) === 1;
      const regionX = rx * map.width - map.width / 2, regionY = ry * map.height - map.height / 2;
      for (let row = 0; row < Math.ceil(level.height / size); row++) for (let col = 0; col < Math.ceil(level.width / size); col++) {
        const w = Math.min(size, level.width - col * size) / density;
        const h = Math.min(size, level.height - row * size) / density;
        const x = regionX + (flipX ? map.width - col * size / density - w : col * size / density);
        const y = regionY + (flipY ? map.height - row * size / density - h : row * size / density);
        if (x + w < view.x || y + h < view.y || x > view.x + view.w || y > view.y + view.h) continue;
        result.push({ key: `${level.id}/${rx}/${ry}/${col}/${row}`, url: `/assets/creative-world/${level.id}/${col}-${row}.webp`, x, y, w, h, flipX, flipY });
        if (result.length >= 96) return result;
      }
    }
    return result;
  }
  function creaturePoint(species, rx, ry, map) {
    const random = terrainEngine.hash;
    const seed = [...species.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return { x: rx * map.width - map.width / 2 + (.12 + random(rx, ry, seed) * .76) * map.width, y: ry * map.height - map.height / 2 + (.12 + random(rx, ry, seed + 9) * .76) * map.height };
  }
  function planCreatures(view, scale, map) {
    if (scale < 0.25 || !map.creatures?.length) return [];
    const result = [];
    const left = Math.floor((view.x + map.width / 2 - 180) / map.width), right = Math.floor((view.x + view.w + map.width / 2 + 180) / map.width);
    const top = Math.floor((view.y + map.height / 2 - 180) / map.height), bottom = Math.floor((view.y + view.h + map.height / 2 + 180) / map.height);
    for (let ry = top; ry <= bottom; ry++) for (let rx = left; rx <= right; rx++) {
      const group = ((rx * 7 + ry * 11) % 3 + 3) % 3;
      map.creatures.forEach((species, index) => {
        if (index % 3 !== group || result.length >= 40) return;
        const point = creaturePoint(species, rx, ry, map), size = species.size || 140;
        if (point.x + size < view.x || point.y + size < view.y || point.x - size > view.x + view.w || point.y - size > view.y + view.h) return;
        result.push({ key: `${species.id}/${rx}/${ry}`, species, x: point.x, y: point.y, size });
      });
      if (result.length >= 40) return result;
    }
    return result;
  }
  function create(world, viewport, panzoom, onCreature) {
    const scene = document.createElement("div"); scene.className = "wall-scenery"; scene.setAttribute("aria-hidden", "true");
    const terrain = document.createElement("div"); terrain.className = "world-terrain";
    const illustration = document.createElement("div"); illustration.className = "world-archipelago";
    const vegetation = document.createElement("div"); vegetation.className = "world-vegetation";
    scene.append(terrain, illustration, vegetation); world.prepend(scene);
    let map, frame, destroyed = false;
    const images = new Map();
    const creatures = new Map();
    const ground = new Map(), plants = new Map();
    let painting;
    function paintNext() {
      painting = null;
      if (destroyed) return;
      const next = [...ground.values()].find((entry) => !entry.painted);
      if (!next) return;
      terrainEngine.paint(next.canvas, next.tile); next.painted = true; next.canvas.dataset.ready = "true";
      painting = requestAnimationFrame(paintNext);
    }
    function draw() {
      frame = null;
      if (!map || viewport.hidden || destroyed) return;
      const scale = panzoom.getScale(), pan = panzoom.getPan();
      const view = { x: -viewport.clientWidth / (2 * scale) - pan.x - 100, y: -viewport.clientHeight / (2 * scale) - pan.y - 100, w: viewport.clientWidth / scale + 200, h: viewport.clientHeight / scale + 200 };
      const groundTiles = terrainEngine.tiles(view, scale), groundKeys = new Set(groundTiles.map((tile) => tile.key));
      for (const [key, entry] of ground) if (!groundKeys.has(key)) { entry.canvas.remove(); ground.delete(key); }
      for (const tile of groundTiles) {
        if (ground.has(tile.key)) continue;
        const canvas = document.createElement("canvas");
        Object.assign(canvas.style, { left: `${tile.x}px`, top: `${tile.y}px`, width: `${tile.size + .5}px`, height: `${tile.size + .5}px` });
        ground.set(tile.key, { canvas, tile, painted: false }); terrain.append(canvas);
      }
      if (!painting) painting = requestAnimationFrame(paintNext);
      const tiles = planTiles(view, scale, window.devicePixelRatio || 1, map), keys = new Set(tiles.map((tile) => tile.key));
      for (const [key, image] of images) if (!keys.has(key)) { image.remove(); images.delete(key); }
      for (const tile of tiles) {
        if (images.has(tile.key)) continue;
        const image = document.createElement("img"); image.alt = ""; image.draggable = false; image.decoding = "async";
        Object.assign(image.style, { left: `${tile.x}px`, top: `${tile.y}px`, width: `${tile.w + 0.3}px`, height: `${tile.h + 0.3}px`, transform: `scale(${tile.flipX ? -1 : 1},${tile.flipY ? -1 : 1})` });
        image.addEventListener("error", () => { image.remove(); images.delete(tile.key); }, { once: true });
        image.src = tile.url; images.set(tile.key, image); illustration.append(image);
      }
      const landmarks = terrainEngine.landmarks(view, scale), plantKeys = new Set(landmarks.map((item) => item.key));
      for (const [key, plant] of plants) if (!plantKeys.has(key)) { plant.remove(); plants.delete(key); }
      for (const item of landmarks) {
        if (plants.has(item.key)) continue;
        const plant = document.createElement("img"); plant.alt = ""; plant.draggable = false; plant.src = `/assets/creative-world/discoveries/${item.kind}.webp`;
        Object.assign(plant.style, { left: `${item.x - item.size / 2}px`, top: `${item.y - item.size / 2}px`, width: `${item.size}px`, height: `${item.size}px` });
        vegetation.append(plant); plants.set(item.key, plant);
      }
      const fauna = planCreatures(view, scale, map), faunaKeys = new Set(fauna.map((item) => item.key));
      for (const [key, button] of creatures) if (!faunaKeys.has(key)) { button.remove(); creatures.delete(key); }
      for (const item of fauna) {
        if (creatures.has(item.key)) continue;
        const button = document.createElement("button"); button.className = "world-creature panzoom-exclude"; button.type = "button"; button.setAttribute("aria-label", item.species.name); button.title = item.species.name;
        Object.assign(button.style, { left: `${item.x - item.size / 2}px`, top: `${item.y - item.size / 2}px`, width: `${item.size}px`, height: `${item.size}px` });
        const image = document.createElement("img"); image.src = `/assets/creative-world/beings/${item.species.id}.webp`; image.alt = ""; image.draggable = false;
        image.onerror = () => { button.remove(); creatures.delete(item.key); };
        button.append(image); button.onclick = () => onCreature?.(item.species); world.append(button); creatures.set(item.key, button);
      }
    }
    function refresh() { if (!frame && !destroyed) frame = requestAnimationFrame(draw); }
    world.addEventListener("panzoomchange", refresh);
    const observer = new ResizeObserver(refresh); observer.observe(viewport);
    const ready = fetch("/assets/creative-world/manifest.json?v=1").then((response) => { if (!response.ok) throw new Error("world_unavailable"); return response.json(); }).then((value) => {
      if (destroyed) return;
      map = value;
      map.zones.push({ id: "arboleda-remota", name: "Arboleda remota", x: 17500, y: -12400 }, { id: "costas", name: "Costas de luz", x: -28000, y: 19000 }, { id: "tierras", name: "Tierras lejanas", x: 64000, y: 36000 });
      viewport.classList.add("world-ready"); refresh(); return map;
    }).catch(() => { viewport.classList.add("world-unavailable"); });
    return { ready, refresh, focusCreature(id) { const index = map?.creatures.findIndex((item) => item.id === id); if (index == null || index < 0) return; const point = creaturePoint(map.creatures[index], index % 3, 0, map); panzoom.zoom(1.15, { animate: false }); requestAnimationFrame(() => panzoom.pan(-point.x, -point.y, { animate: false })); }, destroy() { destroyed = true; observer.disconnect(); world.removeEventListener("panzoomchange", refresh); if (frame) cancelAnimationFrame(frame); if (painting) cancelAnimationFrame(painting); scene.remove(); images.clear(); ground.clear(); plants.clear(); for (const button of creatures.values()) button.remove(); creatures.clear(); } };
  }
  return { planTiles, planCreatures, creaturePoint, create };
});
