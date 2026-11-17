import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export function createWorld(viewport, map, callbacks) {
  const space = window.CreativeSpace;
  const small = viewport.clientWidth < 700;
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1 : 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = "world-webgl";
  renderer.domElement.setAttribute("aria-label", "Mundo de Parchar en tres dimensiones");
  viewport.prepend(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color("#08152b"); scene.fog = new THREE.Fog("#08152b", small ? 350 : 600, small ? 1000 : 1500);
  const camera = new THREE.PerspectiveCamera(62, 1, 2, 7000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  controls.dampingFactor = .09; controls.screenSpacePanning = false; controls.panSpeed = .8;
  controls.minPolarAngle = .25; controls.maxPolarAngle = Math.PI * .49;
  controls.minDistance = 20; controls.maxDistance = 4000;
  controls.mouseButtons.LEFT = THREE.MOUSE.PAN; controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
  controls.touches.ONE = THREE.TOUCH.ROTATE; controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  const origin = new THREE.Vector3(), direction = new THREE.Vector3(), delta = new THREE.Vector3();
  const groundMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  const materials = [];
  function material(color, glow = 0) { const tint = new THREE.Color(color).lerp(new THREE.Color("#ffffff"), glow * .16); const m = new THREE.MeshBasicMaterial({ color: tint, vertexColors: true }); materials.push(m); return m; }
  const bark = material("#684363"), leaves = material("#ffffff", .22), mushrooms = material("#ffffff", .5), stems = material("#98f5e6", .4), crystals = material("#ffffff", .65);
  const geometries = [];
  function shadeGeometry(geometry) {
    // Bake fixed lighting into the mesh: no shadows, postprocessing or per-pixel lights.
    const normal = geometry.attributes.normal;
    if (normal) { const colors = new Float32Array(normal.count * 3); for (let i = 0; i < normal.count; i++) { const shade = .57 + .43 * Math.max(0, normal.getX(i) * -.4 + normal.getY(i) * .8 + normal.getZ(i) * .4); colors.set([shade, shade, shade], i * 3); } geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3)); }
    return geometry;
  }
  function keep(geometry) { shadeGeometry(geometry); geometries.push(geometry); return geometry; }
  const stemGeo = keep(new THREE.CylinderGeometry(3.2, 7, 58, 6));
  const crownGeo = keep(new THREE.SphereGeometry(1, 8, 5));
  const capGeo = keep(new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2));
  const gemGeo = keep(new THREE.ConeGeometry(8, 34, 5));
  const rootGeo = keep(new THREE.CylinderGeometry(1.5, 4, 1, 5));
  const batches = [];
  function batch(geo, mat, count) { const mesh = new THREE.InstancedMesh(geo, mat, count); mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; scene.add(mesh); batches.push(mesh); return mesh; }
  const trunks = batch(stemGeo, bark, 320), crowns = batch(crownGeo, leaves, 960), caps = batch(capGeo, mushrooms, 320), stalks = batch(stemGeo, stems, 320), gems = batch(gemGeo, crystals, 640), roots = batch(rootGeo, bark, 960);
  const dummy = new THREE.Object3D(), tint = new THREE.Color();
  const chunks = new Map(), creatureNodes = new Map(), textureCache = new Map(), postNodes = new Map();
  const textureLoader = new THREE.TextureLoader();
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(), pickups = [];
  const accessible = document.createElement("div"); accessible.className = "world-accessible"; viewport.append(accessible);
  const waterMaterial = new THREE.MeshBasicMaterial({ color: "#137c9d", transparent: true, opacity: .7, depthWrite: false });
  const waterGeo = keep(new THREE.PlaneGeometry(12000, 12000));
  const water = new THREE.Mesh(waterGeo, waterMaterial); water.rotation.x = -Math.PI / 2; water.position.y = 1; scene.add(water);
  let posts = [], active = true, destroyed = false, frame, dirty = true, velocity = 0, flight, last = performance.now(), lastRender = 0, renderCount = 0, reportedCell = "", cell = "", postCell = "", animationUntil = 0;
  let referenceDistance = 390, previousActive = false;
  const budget = { low: small || (navigator.deviceMemory && navigator.deviceMemory < 4), slow: 0, fallback: false };
  const frameTimes = [];
  let readyAt = performance.now();
  const terrainPalette = [new THREE.Color("#173b47"), new THREE.Color("#295958"), new THREE.Color("#4d3370"), new THREE.Color("#386c65")];

  function makeChunk(tile) {
    const divisions = budget.low ? 12 : 20;
    const geometry = new THREE.PlaneGeometry(space.CHUNK, space.CHUNK, divisions, divisions);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.attributes.position, colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i) + tile.x + space.CHUNK / 2, z = position.getZ(i) + tile.z + space.CHUNK / 2;
      const h = space.height(x, z); position.setY(i, h);
      tint.copy(terrainPalette[Math.floor(window.CreativeTerrain.noise(x, z, 1100, 5) * 3.99)]);
      tint.multiplyScalar(.65 + window.CreativeTerrain.noise(x, z, 65, 6) * .6);
      colors[i * 3] = tint.r; colors[i * 3 + 1] = tint.g; colors[i * 3 + 2] = tint.b;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3)); geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, groundMaterial); mesh.position.set(tile.x + space.CHUNK / 2 - origin.x, 0, tile.z + space.CHUNK / 2 - origin.z);
    scene.add(mesh); return mesh;
  }
  function setInstance(mesh, index, x, y, z, sx, sy, sz, rotation = 0, color) {
    dummy.position.set(x - origin.x, y, z - origin.z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(0, rotation, 0); dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix);
    if (color) mesh.setColorAt(index, color);
  }
  function rebuildPlants(x, z) {
    let tree = 0, crown = 0, cap = 0, stalk = 0, gem = 0, root = 0;
    for (const plant of space.plants(x, z, posts, budget.low ? 1 : 2)) {
      const { x: px, z: pz, y, size: s, hue } = plant;
      if (plant.kind === 0) {
        setInstance(trunks, tree++, px, y + 29 * s, pz, s, s, s);
        tint.setHSL(.35 + hue * .5, .78, .53);
        for (let i = 0; i < 3; i++) setInstance(crowns, crown++, px + Math.cos(i * 2.1) * 14 * s, y + (57 + i * 8) * s, pz + Math.sin(i * 2.1) * 14 * s, 43 * s, 8 * s, 18 * s, i * 2.1 + hue * 2, tint);
        for (let i = 0; i < 3; i++) { const angle = i * 2.1; setInstance(roots, root++, px + Math.cos(angle) * 9, y + 5, pz + Math.sin(angle) * 9, s, 20 * s, s, angle); }
      } else if (plant.kind === 1) {
        setInstance(stalks, stalk++, px, y + 13 * s, pz, .45 * s, .45 * s, .45 * s);
        tint.setHSL(.48 + hue * .45, .8, .52);
        setInstance(caps, cap++, px, y + 26 * s, pz, 24 * s, 15 * s, 24 * s, hue * 5, tint);
      } else {
        for (let i = 0; i < 2; i++) { tint.setHSL(.48 + hue * .34, .85, .62); setInstance(gems, gem++, px + i * 10, y + 13 * s, pz + i * 8, s, s * (i ? .65 : 1), s, hue * 6, tint); }
      }
    }
    for (const [mesh, count] of [[trunks, tree], [crowns, crown], [caps, cap], [stalks, stalk], [gems, gem], [roots, root]]) { mesh.count = count; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
  }
  function imageTexture(id) {
    if (textureCache.has(id)) return textureCache.get(id);
    const texture = textureLoader.load(`/assets/creative-world/beings/${id}.webp`, () => { dirty = true; request(); }, undefined, () => { dirty = true; });
    texture.colorSpace = THREE.SRGBColorSpace; textureCache.set(id, texture); return texture;
  }
  function pickButton(label, action) {
    const button = document.createElement("button"); button.type = "button"; button.className = "world-pick"; button.setAttribute("aria-label", label); button.title = label; button.onclick = action;
    accessible.append(button); return button;
  }
  function rebuildBeings(x, z) {
    const desired = space.beings(x, z, posts), keepKeys = new Set(desired.map((item) => item.key));
    for (const [key, node] of creatureNodes) if (!keepKeys.has(key)) { scene.remove(node.sprite); node.sprite.material.dispose(); node.button.remove(); creatureNodes.delete(key); }
    for (const item of desired) {
      if (creatureNodes.has(item.key)) { creatureNodes.get(item.key).sprite.position.set(item.x - origin.x, item.y + 54, item.z - origin.z); continue; }
      const species = map.creatures[item.species];
      const mat = new THREE.SpriteMaterial({ map: imageTexture(species.id), transparent: true, alphaTest: .16, depthTest: true });
      const sprite = new THREE.Sprite(mat); sprite.scale.set(110, 110, 1); sprite.position.set(item.x - origin.x, item.y + 54, item.z - origin.z); sprite.userData = { type: "creature", species };
      const button = pickButton(species.name, () => callbacks.onCreature(species));
      scene.add(sprite); creatureNodes.set(item.key, { sprite, button, species });
    }
    const used = new Set([...creatureNodes.values()].map((node) => node.species.id));
    for (const [id, texture] of textureCache) if (!used.has(id)) { texture.dispose(); textureCache.delete(id); }
  }
  function signTexture(post) {
    const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 384;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#251729"; ctx.beginPath(); ctx.moveTo(30, 18); ctx.lineTo(470, 7); ctx.lineTo(505, 95); ctx.lineTo(487, 362); ctx.lineTo(42, 378); ctx.lineTo(8, 275); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#ae8d66"; ctx.lineWidth = 12; ctx.stroke();
    for (let i = 0; i < 17; i++) { ctx.strokeStyle = i % 3 ? "#63463445" : "#a7956045"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(20, 15 + i * 22); ctx.bezierCurveTo(160, i * 22 + 45, 350, i * 22 - 20, 498, i * 22 + 10); ctx.stroke(); }
    const art = document.createElement("canvas"); art.width = 400; art.height = 300;
    window.CreativeRender.draw(art, post, false, true); ctx.drawImage(art, 40, 38, 420, 290);
    ctx.font = "600 27px Georgia, serif"; ctx.fillStyle = "#fff0c4"; ctx.shadowColor = "#10091d"; ctx.shadowBlur = 4;
    let line = "", lines = [];
    for (const char of String(post.text || "Una creación por descubrir")) { if (char === "\n" || ctx.measureText(line + char).width > 410) { lines.push(line); line = char === "\n" ? "" : char; } else line += char; }
    if (line) lines.push(line);
    lines.slice(0, 7).forEach((value, i) => ctx.fillText(value + (i === 6 && lines.length > 7 ? "…" : ""), 48, 58 + i * 35));
    ctx.font = "italic 22px Georgia, serif"; ctx.fillStyle = "#84f3d9"; ctx.fillText(String(post.alias).slice(0, 24), 48, 346);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
  }
  function syncPosts(values) {
    const ids = new Set(values.map((post) => post.id));
    for (const [id, node] of postNodes) if (!ids.has(id)) { scene.remove(node.group); node.group.traverse((obj) => { if (obj.material && !materials.includes(obj.material)) { obj.material.map?.dispose(); obj.material.dispose(); } if (obj.geometry && !geometries.includes(obj.geometry)) obj.geometry.dispose(); }); node.button.remove(); postNodes.delete(id); }
    for (const post of values) {
      if (postNodes.has(post.id)) continue;
      const x = post.x + 160, z = post.y + 165, y = Math.max(10, space.height(x, z));
      const group = new THREE.Group(); group.position.set(x - origin.x, y, z - origin.z);
      const pieces = [new THREE.DodecahedronGeometry(1, 0).scale(78, 47, 16).translate(0, 70, 0), new THREE.CylinderGeometry(5, 9, 48, 7).toNonIndexed().translate(-35, 24, 0), new THREE.CylinderGeometry(5, 9, 48, 7).toNonIndexed().translate(35, 24, 0), new THREE.DodecahedronGeometry(1, 0).scale(100, 12, 65)];
      const slab = new THREE.Mesh(shadeGeometry(mergeGeometries(pieces)), bark); pieces.forEach((part) => part.dispose());
      const face = new THREE.Mesh(new THREE.PlaneGeometry(124, 91), new THREE.MeshBasicMaterial({ map: signTexture(post), transparent: true, alphaTest: .12, side: THREE.DoubleSide })); face.position.set(0, 70, 16.2);
      group.add(slab, face);
      group.userData = { type: "post", id: post.id }; group.traverse((obj) => { obj.userData = group.userData; }); scene.add(group);
      const button = pickButton(`Descubrir la creación de ${post.alias}`, () => callbacks.onPost(post.id));
      postNodes.set(post.id, { group, button, x, z });
    }
    dirty = true;
  }
  function setPosts(values) { posts = values; cell = ""; postCell = ""; dirty = true; request(); }
  function rebase() {
    if (Math.abs(camera.position.x) < 10000 && Math.abs(camera.position.z) < 10000) return;
    delta.set(Math.trunc(camera.position.x / space.CHUNK) * space.CHUNK, 0, Math.trunc(camera.position.z / space.CHUNK) * space.CHUNK);
    origin.add(delta); camera.position.sub(delta); controls.target.sub(delta);
    if (flight) for (const point of [flight.fromCamera, flight.toCamera, flight.fromTarget, flight.toTarget]) point.sub(delta);
    for (const node of chunks.values()) node.mesh?.position.sub(delta);
    for (const node of creatureNodes.values()) node.sprite.position.sub(delta);
    for (const node of postNodes.values()) node.group.position.sub(delta);
    cell = "";
  }
  function updateVisible() {
    const x = camera.position.x + origin.x, z = camera.position.z + origin.z;
    const nextPostCell = `${Math.floor(x / 128)}/${Math.floor(z / 128)}`;
    if (postCell !== nextPostCell) {
      postCell = nextPostCell;
      const nearby = posts.filter((post) => Math.hypot(post.x + 160 - x, post.y + 165 - z) < 1400).sort((a, b) => Math.hypot(a.x + 160 - x, a.y + 165 - z) - Math.hypot(b.x + 160 - x, b.y + 165 - z)).slice(0, budget.low ? 6 : 10);
      syncPosts(nearby);
    }
    const nextCell = `${Math.floor(x / space.CHUNK)}/${Math.floor(z / space.CHUNK)}/${budget.low}`;
    if (cell !== nextCell) {
      cell = nextCell;
      const wanted = space.chunks(x, z, budget.low ? 1 : 2), keys = new Set(wanted.map((tile) => tile.key));
      for (const [key, entry] of chunks) if (!keys.has(key)) { if (entry.mesh) { scene.remove(entry.mesh); entry.mesh.geometry.dispose(); } chunks.delete(key); }
      for (const tile of wanted) if (!chunks.has(tile.key)) chunks.set(tile.key, { tile, mesh: null });
      rebuildBeings(x, z); rebuildPlants(x, z);
    }
    const next = [...chunks.values()].find((entry) => !entry.mesh);
    if (next) { next.mesh = makeChunk(next.tile); dirty = true; }
    water.position.x = camera.position.x; water.position.z = camera.position.z;
    const query = JSON.stringify(space.queryBounds(x, z));
    if (reportedCell !== query) { reportedCell = query; callbacks.onMove(); }
    return !!next;
  }
  const projection = new THREE.Vector3();
  function projectButton(node, position) {
    projection.copy(position); projection.project(camera);
    const visible = projection.z > -1 && projection.z < 1 && Math.abs(projection.x) < 1 && Math.abs(projection.y) < 1;
    node.button.hidden = !visible;
    if (visible) { node.button.style.left = `${(projection.x + 1) * viewport.clientWidth / 2 - 22}px`; node.button.style.top = `${(1 - projection.y) * viewport.clientHeight / 2 - 22}px`; }
  }
  function safeTick(now) { try { tick(now); } catch { callbacks.onFallback("El mundo 3D no pudo continuar. Puedes seguir en la vista ligera."); } }
  function request() { if (!destroyed && !frame) frame = requestAnimationFrame(safeTick); }
  function tick(now) {
    frame = null;
    if (destroyed || !active || document.hidden) { last = now; return; }
    const frameMs = now - last, elapsed = Math.min(60, frameMs), dt = Math.max(.001, elapsed / 1000); last = now;
    const wasMoving = !!flight || Math.abs(velocity) > 1 || now < animationUntil;
    if (flight) {
      const t = Math.min(1, (now - flight.start) / flight.duration), ease = t * t * (3 - 2 * t);
      camera.position.lerpVectors(flight.fromCamera, flight.toCamera, ease); controls.target.lerpVectors(flight.fromTarget, flight.toTarget, ease); dirty = true;
      if (t >= 1) { flight = null; referenceDistance = camera.position.distanceTo(controls.target); }
    }
    if (Math.abs(velocity) > 1) {
      camera.getWorldDirection(direction); direction.y = 0; direction.normalize().multiplyScalar(velocity * dt);
      camera.position.add(direction); controls.target.add(direction); velocity *= Math.pow(.9, dt * 60); dirty = true;
    }
    controls.update(dt);
    // Convert pinch dolly into travel, preserving the view distance so it has no image-zoom stop.
    if (!flight) { const distance = camera.position.distanceTo(controls.target), difference = referenceDistance - distance; if (Math.abs(difference) > .05) { camera.getWorldDirection(direction); controls.target.addScaledVector(direction, difference); dirty = true; } }
    const floor = Math.max(35, space.height(camera.position.x + origin.x, camera.position.z + origin.z) + 35);
    if (camera.position.y < floor) { const rise = floor - camera.position.y; camera.position.y += rise; controls.target.y += rise; dirty = true; }
    rebase();
    const streaming = updateVisible();
    if (dirty || wasMoving || streaming) {
      renderer.render(scene, camera); dirty = false; renderCount++;
      for (const node of creatureNodes.values()) projectButton(node, node.sprite.position);
      for (const node of postNodes.values()) { projection.copy(node.group.position); projection.y += 70; projectButton(node, projection); }
      if (wasMoving && previousActive && now - readyAt > 3500 && frameMs < 250) {
        const ms = frameMs; frameTimes.push(ms); if (frameTimes.length > 180) frameTimes.shift();
        const oldLow = budget.low; space.observeBudget(budget, ms, true);
        if (budget.low !== oldLow) { resize(); cell = ""; postCell = ""; scene.fog.near = 350; scene.fog.far = 1000; }
        if (budget.fallback) { callbacks.onFallback("Este dispositivo necesita la vista ligera para mantener la fluidez."); return; }
      }
      lastRender = now;
      viewport.dataset.frames = String(renderCount); viewport.dataset.drawCalls = String(renderer.info.render.calls); viewport.dataset.triangles = String(renderer.info.render.triangles); viewport.dataset.quality = budget.low ? "light" : "normal";
      viewport.dataset.worldX = (camera.position.x + origin.x).toFixed(1); viewport.dataset.worldZ = (camera.position.z + origin.z).toFixed(1);
      viewport.dataset.geometries = String(renderer.info.memory.geometries); viewport.dataset.textures = String(renderer.info.memory.textures); viewport.dataset.postCount = String(postNodes.size); viewport.dataset.beingCount = String(creatureNodes.size);
      if (frameTimes.length) viewport.dataset.frameMs = (frameTimes.reduce((sum, v) => sum + v, 0) / frameTimes.length).toFixed(1);
    }
    previousActive = wasMoving;
    if (wasMoving || streaming || now < animationUntil) request();
  }
  function focus(x, z) {
    controls.enabled = true; velocity = 0;
    const y = Math.max(10, space.height(x, z));
    const target = new THREE.Vector3(x - origin.x, y + 55, z - origin.z);
    const eye = new THREE.Vector3(x - origin.x, y + 140, z + 340 - origin.z);
    if (camera.position.distanceTo(eye) > 3000) { camera.position.copy(eye); controls.target.copy(target); referenceDistance = camera.position.distanceTo(controls.target); flight = null; rebase(); controls.update(); dirty = true; request(); return; }
    const duration = matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 700;
    flight = { fromCamera: camera.position.clone(), fromTarget: controls.target.clone(), toCamera: eye, toTarget: target, start: performance.now(), duration }; animationUntil = performance.now() + duration + 500; request();
  }
  function forward(amount) { flight = null; velocity = Math.max(-700, Math.min(700, velocity + amount)); animationUntil = performance.now() + 1000; request(); }
  function wheel(event) { event.preventDefault(); event.stopImmediatePropagation(); const dy = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1); forward(Math.max(-220, Math.min(220, -dy * 2))); }
  renderer.domElement.addEventListener("wheel", wheel, { passive: false, capture: true });
  let press;
  const pointers = new Set();
  function down(event) { pointers.add(event.pointerId); press = pointers.size === 1 ? { x: event.clientX, y: event.clientY, at: performance.now() } : null; }
  function up(event) {
    pointers.delete(event.pointerId);
    if (pointers.size) { press = null; return; }
    if (!press || Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8 || performance.now() - press.at > 650) return;
    const rect = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(pointer, camera);
    pickups.length = 0; for (const node of creatureNodes.values()) pickups.push(node.sprite); for (const node of postNodes.values()) pickups.push(node.group);
    const hit = raycaster.intersectObjects(scene.children, true)[0]?.object.userData;
    if (hit?.type === "post") callbacks.onPost(hit.id); else if (hit?.type === "creature") callbacks.onCreature(hit.species);
    press = null;
  }
  renderer.domElement.addEventListener("pointerdown", down); renderer.domElement.addEventListener("pointerup", up);
  renderer.domElement.addEventListener("pointercancel", (event) => { pointers.delete(event.pointerId); press = null; });
  controls.addEventListener("start", () => { flight = null; referenceDistance = camera.position.distanceTo(controls.target); animationUntil = performance.now() + 60000; request(); });
  controls.addEventListener("end", () => { animationUntil = performance.now() + 700; request(); });
  controls.addEventListener("change", () => { dirty = true; request(); });
  function resize() { const w = Math.max(1, viewport.clientWidth), h = Math.max(1, viewport.clientHeight); camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, budget.low ? 1 : 1.25, Math.sqrt((budget.low ? 260000 : 900000) / (w * h)))); renderer.setSize(w, h, false); dirty = true; request(); }
  const observer = new ResizeObserver(resize); observer.observe(viewport);
  const onVisibility = () => { last = performance.now(); readyAt = last; if (!document.hidden) request(); };
  document.addEventListener("visibilitychange", onVisibility);
  const onContextLoss = (event) => { event.preventDefault(); callbacks.onFallback("El dispositivo interrumpió el mundo 3D. Puedes continuar en la vista ligera."); };
  renderer.domElement.addEventListener("webglcontextlost", onContextLoss);
  camera.position.set(160, 180, 505); controls.target.set(160, 60, 165); referenceDistance = camera.position.distanceTo(controls.target); controls.update(); resize(); request();
  return {
    setPosts, focus, forward, bounds() { return space.queryBounds(camera.position.x + origin.x, camera.position.z + origin.z); },
    move(x, z) { flight = null; camera.getWorldDirection(direction); direction.y = 0; direction.normalize(); delta.set(-direction.z * x + direction.x * z, 0, direction.x * x + direction.z * z); camera.position.add(delta); controls.target.add(delta); dirty = true; request(); },
    focusCreature(id) { const index = map.creatures.findIndex((item) => item.id === id); if (index < 0) return; const point = space.beings((index % 6 + .5) * space.CHUNK, (Math.floor(index / 6) + .5) * space.CHUNK, posts).find((item) => item.species === index); if (point) focus(point.x, point.z); },
    refresh() { resize(); }, setActive(value) { active = value; controls.enabled = value; last = performance.now(); if (value) { dirty = true; request(); } },
    destroy() { if (destroyed) return; destroyed = true; if (frame) cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener("visibilitychange", onVisibility); controls.dispose(); renderer.domElement.removeEventListener("webglcontextlost", onContextLoss); scene.traverse((obj) => { obj.geometry?.dispose(); if (obj.material?.map && !textureCache.has(obj.userData.species?.id)) obj.material.map.dispose(); if (obj.material && !Array.isArray(obj.material)) obj.material.dispose(); }); for (const texture of textureCache.values()) texture.dispose(); for (const geo of geometries) geo.dispose(); groundMaterial.dispose(); waterMaterial.dispose(); for (const mat of materials) mat.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); accessible.remove(); textureCache.clear(); chunks.clear(); postNodes.clear(); creatureNodes.clear(); scene.clear(); geometries.length = 0; materials.length = 0; batches.length = 0; pickups.length = 0; posts = []; flight = null; }
  };
}
