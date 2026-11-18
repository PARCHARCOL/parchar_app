import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createForestKit, createWaterfallKit } from "./creative-botany.js";

export function createWorld(viewport, map, callbacks) {
  const space = window.CreativeSpace;
  const small = viewport.clientWidth < 700;
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1 : 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = "world-webgl";
  renderer.domElement.style.visibility = "hidden";
  renderer.domElement.setAttribute("aria-label", "Mundo de Parchar en tres dimensiones");
  viewport.prepend(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color("#08152b"); scene.fog = new THREE.Fog("#08152b", small ? 350 : 600, small ? 1000 : 1500);
  const camera = new THREE.PerspectiveCamera(62, 1, 2, 7000);
  const skyCanvas = document.createElement("canvas"); skyCanvas.width = 512; skyCanvas.height = 256;
  const skyMap = new THREE.CanvasTexture(skyCanvas); skyMap.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 24, 12), new THREE.MeshBasicMaterial({ map: skyMap, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -10; sky.userData.sky = true; scene.add(sky);
  let skyPhase = "";
  function updateSky() {
    const now = new Date(), palette = space.daylight(now.getHours() + now.getMinutes() / 60);
    if (palette.phase === skyPhase) return;
    skyPhase = palette.phase; viewport.dataset.skyPhase = skyPhase;
    const ctx = skyCanvas.getContext("2d"), gradient = ctx.createLinearGradient(0,0,0,256);
    gradient.addColorStop(0,palette.top); gradient.addColorStop(.53,palette.horizon); gradient.addColorStop(1,palette.fog);
    ctx.fillStyle=gradient; ctx.fillRect(0,0,512,256);
    if (skyPhase === "noche") {
      for (let i=0;i<130;i++) { ctx.fillStyle=i%4 ? "#cadbff" : "#fff4be"; ctx.fillRect(window.CreativeTerrain.hash(i,0,401)*512,window.CreativeTerrain.hash(i,0,402)*110,1,1); }
      ctx.fillStyle="#e7edff"; ctx.beginPath(); ctx.arc(355,55,9,0,Math.PI*2); ctx.fill();
    } else { ctx.fillStyle=skyPhase==="dia" ? "#fff6cb" : "#ffe2ad"; ctx.beginPath(); ctx.arc(355,skyPhase==="dia"?65:120,12,0,Math.PI*2); ctx.fill(); }
    skyMap.needsUpdate=true; scene.fog.color.set(palette.fog); groundMaterial.color.setScalar(palette.light); dirty=true; request();
  }
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  controls.dampingFactor = .09; controls.screenSpacePanning = false; controls.panSpeed = .8;
  controls.minPolarAngle = space.MIN_POLAR; controls.maxPolarAngle = space.MAX_POLAR;
  controls.minDistance = 20; controls.maxDistance = 4000;
  controls.enablePan = false;
  controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE; controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
  controls.touches.ONE = THREE.TOUCH.ROTATE; controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
  const origin = new THREE.Vector3(), direction = new THREE.Vector3(), delta = new THREE.Vector3(), walkEye = new THREE.Vector3();
  const groundMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  const groundCanvas = document.createElement("canvas"); groundCanvas.width = 256; groundCanvas.height = 256;
  const groundContext = groundCanvas.getContext("2d"); groundContext.fillStyle = "#b2c3ae"; groundContext.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) { groundContext.fillStyle = ["#183a2555", "#6c8c5b77", "#c7cfac99", "#5f806988"][i % 4]; groundContext.beginPath(); groundContext.ellipse(window.CreativeTerrain.hash(i, 0, 155) * 256, window.CreativeTerrain.hash(i, 0, 156) * 256, 1 + i % 4, 2 + i % 7, i, 0, Math.PI * 2); groundContext.fill(); }
  const groundMap = new THREE.CanvasTexture(groundCanvas); groundMap.colorSpace = THREE.SRGBColorSpace; groundMap.wrapS = groundMap.wrapT = THREE.RepeatWrapping; groundMap.repeat.set(12, 12); groundMaterial.map = groundMap;
  const materials = [];
  const distantMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }); materials.push(distantMaterial);
  const distant = new THREE.Mesh(new THREE.BufferGeometry(), distantMaterial); scene.add(distant);
  function material(color, glow = 0) { const tint = new THREE.Color(color).lerp(new THREE.Color("#ffffff"), glow * .16); const m = new THREE.MeshBasicMaterial({ color: tint, vertexColors: true }); materials.push(m); return m; }
  const geometries = [];
  function shadeGeometry(geometry) {
    if (geometry.userData.fullLight) return geometry;
    // Bake fixed lighting into the mesh: no shadows, postprocessing or per-pixel lights.
    const normal = geometry.attributes.normal;
    if (normal) { const colors = new Float32Array(normal.count * 3); for (let i = 0; i < normal.count; i++) { const shade = .57 + .43 * Math.max(0, normal.getX(i) * -.4 + normal.getY(i) * .8 + normal.getZ(i) * .4); colors.set([shade, shade, shade], i * 3); } geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3)); }
    return geometry;
  }
  function keep(geometry) { shadeGeometry(geometry); geometries.push(geometry); return geometry; }
  const batches = [];
  function batch(geo, mat, count) { const mesh = new THREE.InstancedMesh(geo, mat, count); mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; scene.add(mesh); batches.push(mesh); return mesh; }
  const dummy = new THREE.Object3D(), tint = new THREE.Color();
  const chunks = new Map(), creatureNodes = new Map(), textureCache = new Map(), postNodes = new Map();
  const textureLoader = new THREE.TextureLoader();
  const kitOptions = { keep, batch, material, materials, set: setInstance, random: window.CreativeTerrain.hash, changed: () => { dirty = true; request(); } };
  const forest = createForestKit(kitOptions), waterfalls = createWaterfallKit(kitOptions);
  const bladePositions=[];
  for (let i=0;i<5;i++) { const a=i*Math.PI*.4, x=Math.cos(a)*.35,z=Math.sin(a)*.35; bladePositions.push(x-.07,0,z,x+.07,0,z,x*.6,.65+i*.07,z*.6); }
  const grassGeo=new THREE.BufferGeometry(); grassGeo.setAttribute("position",new THREE.Float32BufferAttribute(bladePositions,3)); grassGeo.computeVertexNormals();
  const grassMaterial=material("#68c9a2"); grassMaterial.side=THREE.DoubleSide;
  const grass=batch(keep(grassGeo),grassMaterial,1400);
  const riverPositions=[], riverUv=[], riverIndex=[];
  for (let i=0;i<=80;i++) { const z=-15+i*2415/80,r=space.river(z); riverPositions.push(r.x-r.width,r.y,z,r.x+r.width,r.y,z); riverUv.push(0,i/6,1,i/6); if(i<80){const n=i*2;riverIndex.push(n,n+2,n+1,n+1,n+2,n+3);} }
  const riverGeo=keep(new THREE.BufferGeometry()); riverGeo.setAttribute("position",new THREE.Float32BufferAttribute(riverPositions,3)); riverGeo.setAttribute("uv",new THREE.Float32BufferAttribute(riverUv,2)); riverGeo.setIndex(riverIndex); riverGeo.computeVertexNormals();
  const stream=new THREE.Mesh(riverGeo,waterfalls.waterMaterial); scene.add(stream);
  const assetsReady = Promise.all([forest.ready, waterfalls.ready]).then(() => { readyAt = performance.now(); dirty = true; request(); });
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(), pickups = [];
  let alphaCache = new WeakMap();
  const accessible = document.createElement("div"); accessible.className = "world-accessible"; viewport.append(accessible);
  const waterMaterial = new THREE.MeshBasicMaterial({ color: "#137c9d", transparent: true, opacity: .7, depthWrite: false });
  const waterGeo = keep(new THREE.PlaneGeometry(12000, 12000));
  const water = new THREE.Mesh(waterGeo, waterMaterial); water.rotation.x = -Math.PI / 2; water.position.y = 1; scene.add(water);
  let posts = [], active = true, destroyed = false, frame, dirty = true, velocity = 0, flight, last = performance.now(), lastRender = 0, renderCount = 0, reportedCell = "", cell = "", postCell = "", animationUntil = 0;
  let referenceDistance = 390, previousActive = false, navigationSync = false;
  const budget = { low: small || (navigator.deviceMemory && navigator.deviceMemory < 4), slow: 0, fallback: false };
  const frameTimes = [];
  let readyAt = performance.now();
  const terrainPalette = [new THREE.Color("#225e4c"), new THREE.Color("#287a64"), new THREE.Color("#305c70"), new THREE.Color("#4b8b62")];

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
  function setInstance(mesh, index, x, y, z, sx, sy, sz, rotation = 0, color, tilt = 0, roll = 0) {
    dummy.position.set(x - origin.x, y, z - origin.z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(tilt, rotation, roll, "YXZ"); dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix);
    if (color) mesh.setColorAt(index, color);
  }
  function rebuildPlants(x, z) {
    const plants = space.plants(x, z, posts, budget.low ? 1 : 2);
    forest.update(plants, budget.low); waterfalls.update(space.waterfalls(x, z), space.height);
    viewport.dataset.plantCount = String(plants.length);
    const cover=space.groundCover(x,z,posts,budget.low);
    cover.grass.forEach((p,i)=>setInstance(grass,i,p.x,p.y,p.z,p.size*2.5,p.size,p.size*2.5,p.hue*6));
    grass.count=cover.grass.length; grass.instanceMatrix.needsUpdate=true; grass.boundingSphere=null;
    waterfalls.groundRocks(cover.rocks); viewport.dataset.grassCount=String(cover.grass.length); viewport.dataset.rockCount=String(cover.rocks.length);
    stream.position.set(-origin.x,0,-origin.z);
  }
  function rebuildDistantLandscape(x, z) {
    const cx = Math.floor(x / space.CHUNK) * space.CHUNK + space.CHUNK / 2, cz = Math.floor(z / space.CHUNK) * space.CHUNK + space.CHUNK / 2;
    const geometry = new THREE.PlaneGeometry(6400, 6400, 40, 40); geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position, colors = new Float32Array(positions.count * 3), index = [], hole = (budget.low ? 1.5 : 2.5) * space.CHUNK;
    for (let i = 0; i < positions.count; i++) {
      const h = space.height(positions.getX(i) + cx, positions.getZ(i) + cz); positions.setY(i, h);
      tint.set("#193c4b").lerp(new THREE.Color("#59607e"), THREE.MathUtils.clamp(h / 420, 0, 1));
      colors.set([tint.r, tint.g, tint.b], i * 3);
    }
    const original = geometry.index.array;
    for (let i = 0; i < original.length; i += 3) { const a = original[i], b = original[i + 1], c = original[i + 2]; const px = (positions.getX(a) + positions.getX(b) + positions.getX(c)) / 3, pz = (positions.getZ(a) + positions.getZ(b) + positions.getZ(c)) / 3; if (Math.abs(px) >= hole || Math.abs(pz) >= hole) index.push(a, b, c); }
    geometry.setIndex(index); geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    distant.geometry.dispose(); distant.geometry = geometry; distant.position.set(cx - origin.x, 0, cz - origin.z);
  }
  function imageTexture(id) {
    if (textureCache.has(id)) return textureCache.get(id);
    const texture = textureLoader.load(`/assets/creative-world/beings/${id}.webp`, (loaded) => { loaded.userData.loaded = true; for (const node of creatureNodes.values()) if (node.sprite.material.map === loaded) node.sprite.visible = true; dirty = true; request(); }, undefined, () => { dirty = true; });
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
      const sprite = new THREE.Sprite(mat); sprite.visible = !!mat.map.userData.loaded; sprite.scale.set(110, 110, 1); sprite.position.set(item.x - origin.x, item.y + 54, item.z - origin.z); sprite.userData = { type: "creature", species };
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
      const slab = new THREE.Mesh(shadeGeometry(mergeGeometries(pieces)), forest.bark); pieces.forEach((part) => part.dispose());
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
    origin.add(delta); camera.position.sub(delta); controls.target.sub(delta); walkEye.sub(delta);
    if (flight) for (const point of [flight.fromCamera, flight.toCamera, flight.fromTarget, flight.toTarget]) point.sub(delta);
    for (const node of chunks.values()) node.mesh?.position.sub(delta);
    for (const node of creatureNodes.values()) node.sprite.position.sub(delta);
    for (const node of postNodes.values()) node.group.position.sub(delta);
    distant.position.sub(delta);
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
      rebuildPlants(x, z);
      rebuildDistantLandscape(x, z);
    }
    const next = [...chunks.values()].find((entry) => !entry.mesh);
    if (next) { next.mesh = makeChunk(next.tile); dirty = true; }
    water.position.x = camera.position.x; water.position.z = camera.position.z;
    sky.position.copy(camera.position);
    const query = JSON.stringify(space.queryBounds(x, z));
    if (reportedCell !== query) { reportedCell = query; callbacks.onMove(); }
    return !!next;
  }
  const projection = new THREE.Vector3();
  function projectButton(node, position) {
    if (node.sprite && !node.sprite.visible) { node.button.hidden = true; return; }
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
    updateSky();
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
    walkEye.copy(camera.position); navigationSync = !!flight; controls.update(dt); navigationSync = false;
    const desiredEye = space.eyeLevel(camera.position.x + origin.x, camera.position.z + origin.z);
    if (!flight && Math.abs(camera.position.y - desiredEye) > .05) {
      const y = THREE.MathUtils.lerp(camera.position.y, desiredEye, 1 - Math.exp(-dt * 9));
      const change = Math.max(desiredEye - 18, y) - camera.position.y; camera.position.y += change; controls.target.y += change; dirty = true;
    }
    walkEye.copy(camera.position);
    rebase();
    const streaming = updateVisible();
    if (dirty || wasMoving || streaming) {
      renderer.render(scene, camera); dirty = false; renderCount++;
      for (const node of creatureNodes.values()) projectButton(node, node.sprite.position);
      for (const node of postNodes.values()) { projection.copy(node.group.position); projection.y += 70; projectButton(node, projection); }
      if (wasMoving && previousActive && now - readyAt > 3500) {
        const ms = frameMs; frameTimes.push(ms); if (frameTimes.length > 180) frameTimes.shift();
        const oldLow = budget.low; space.observeBudget(budget, Math.min(ms, 800), true);
        if (budget.low !== oldLow) { resize(); cell = ""; postCell = ""; scene.fog.near = 350; scene.fog.far = 1000; }
        if (budget.fallback) { callbacks.onFallback("Este dispositivo necesita la vista ligera para mantener la fluidez."); return; }
      }
      lastRender = now;
      viewport.dataset.frames = String(renderCount); viewport.dataset.drawCalls = String(renderer.info.render.calls); viewport.dataset.triangles = String(renderer.info.render.triangles); viewport.dataset.quality = budget.low ? "light" : "normal";
      viewport.dataset.worldX = (camera.position.x + origin.x).toFixed(1); viewport.dataset.worldZ = (camera.position.z + origin.z).toFixed(1);
      viewport.dataset.eyeAboveGround = (camera.position.y - Math.max(12, space.height(camera.position.x + origin.x, camera.position.z + origin.z))).toFixed(1); viewport.dataset.pitch = controls.getPolarAngle().toFixed(3);
      viewport.dataset.geometries = String(renderer.info.memory.geometries); viewport.dataset.textures = String(renderer.info.memory.textures); viewport.dataset.postCount = String(postNodes.size); viewport.dataset.beingCount = String(creatureNodes.size);
      if (frameTimes.length) viewport.dataset.frameMs = (frameTimes.reduce((sum, v) => sum + v, 0) / frameTimes.length).toFixed(1);
    }
    previousActive = wasMoving;
    if (wasMoving || streaming || now < animationUntil) request();
  }
  function focus(x, z) {
    controls.enabled = true; velocity = 0;
    const y = Math.max(10, space.height(x, z));
    const landing = space.viewpoint(x, z, posts), eyeY = space.eyeLevel(landing.x, landing.z);
    const target = new THREE.Vector3(x - origin.x, y + 55, z - origin.z);
    const eye = new THREE.Vector3(landing.x - origin.x, eyeY, landing.z - origin.z);
    if (camera.position.distanceTo(eye) > 3000) { camera.position.copy(eye); controls.target.copy(target); walkEye.copy(camera.position); referenceDistance = camera.position.distanceTo(controls.target); flight = null; rebase(); navigationSync = true; controls.update(); navigationSync = false; walkEye.copy(camera.position); dirty = true; request(); return; }
    const duration = matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 700;
    flight = { fromCamera: camera.position.clone(), fromTarget: controls.target.clone(), toCamera: eye, toTarget: target, start: performance.now(), duration }; animationUntil = performance.now() + duration + 500; request();
  }
  function forward(amount) { flight = null; velocity = Math.max(-700, Math.min(700, velocity + amount)); animationUntil = performance.now() + 1000; request(); }
  function wheel(event) { event.preventDefault(); event.stopImmediatePropagation(); const dy = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1); forward(Math.max(-220, Math.min(220, -dy * 2))); }
  renderer.domElement.addEventListener("wheel", wheel, { passive: false, capture: true });
  let press;
  const pointers = new Set();
  function down(event) { pointers.add(event.pointerId); press = pointers.size === 1 ? { x: event.clientX, y: event.clientY, at: performance.now() } : null; }
  function visibleHit(hit) {
    const material = hit.object.material, texture = material?.map;
    if (!material?.alphaTest || !texture?.image || !hit.uv) return true;
    try {
      if (!alphaCache.has(texture)) {
        const image = texture.image, canvas = document.createElement("canvas"); canvas.width = Math.min(192, image.width); canvas.height = Math.max(1, Math.round(canvas.width * image.height / image.width));
        const ctx = canvas.getContext("2d", { willReadFrequently: true }); ctx.drawImage(image, 0, 0, canvas.width, canvas.height); alphaCache.set(texture, { w: canvas.width, h: canvas.height, pixels: ctx.getImageData(0, 0, canvas.width, canvas.height).data });
      }
      const sample = alphaCache.get(texture), uv = hit.uv.clone(); texture.updateMatrix(); texture.transformUv(uv);
      const x = Math.max(0, Math.min(sample.w - 1, Math.floor(uv.x * sample.w))), y = Math.max(0, Math.min(sample.h - 1, Math.floor(uv.y * sample.h)));
      return sample.pixels[(y * sample.w + x) * 4 + 3] / 255 >= material.alphaTest;
    } catch { return true; }
  }
  function up(event) {
    pointers.delete(event.pointerId);
    if (pointers.size) { press = null; return; }
    if (!press || Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8 || performance.now() - press.at > 650) return;
    const rect = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(pointer, camera);
    pickups.length = 0; for (const node of creatureNodes.values()) pickups.push(node.sprite); for (const node of postNodes.values()) pickups.push(node.group);
    const hit = raycaster.intersectObjects(scene.children, true).find(visibleHit)?.object.userData;
    if (placing) {
      const groundHit=raycaster.intersectObjects([...chunks.values()].map((c)=>c.mesh).filter(Boolean))[0];
      if (groundHit) { const x=groundHit.point.x+origin.x,z=groundHit.point.z+origin.z,r=space.river(z); if ((!r || Math.abs(x-r.x)>r.width+10) && !space.nearPost(x,z,posts,180)) { placing=false; viewport.classList.remove("world-placing"); callbacks.onPlace?.({x:Math.round(x-160),y:Math.round(z-165)}); } else callbacks.onPlaceError?.("Elige tierra firme, separada de los otros mensajes."); }
    } else if (hit?.type === "post") callbacks.onPost(hit.id); else if (hit?.type === "creature") callbacks.onCreature(hit.species);
    press = null;
  }
  renderer.domElement.addEventListener("pointerdown", down); renderer.domElement.addEventListener("pointerup", up);
  function placeKey(event) {
    if(!placing || !["Enter"," "].includes(event.key) || event.target!==viewport)return;
    event.preventDefault();const rect=renderer.domElement.getBoundingClientRect();
    const point={pointerId:-1,clientX:rect.x+rect.width/2,clientY:rect.y+rect.height*.8};down(point);up(point);
  }
  viewport.addEventListener("keydown",placeKey);
  renderer.domElement.addEventListener("pointercancel", (event) => { pointers.delete(event.pointerId); press = null; });
  controls.addEventListener("start", () => { flight = null; referenceDistance = camera.position.distanceTo(controls.target); animationUntil = performance.now() + 60000; request(); });
  controls.addEventListener("end", () => { animationUntil = performance.now() + 700; request(); });
  controls.addEventListener("change", () => {
    // OrbitControls also updates synchronously during pointer events; anchor those changes immediately.
    if (!navigationSync && !flight) {
      const travel = referenceDistance - camera.position.distanceTo(controls.target);
      camera.getWorldDirection(direction); camera.position.copy(walkEye);
      if (Math.abs(travel) > .05) camera.position.add(delta.set(direction.x, 0, direction.z).normalize().multiplyScalar(travel));
      controls.target.copy(camera.position).addScaledVector(direction, referenceDistance); walkEye.copy(camera.position);
    }
    dirty = true; request();
  });
  function resize() { const w = Math.max(1, viewport.clientWidth), h = Math.max(1, viewport.clientHeight); camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, budget.low ? .85 : 1.25, Math.sqrt((budget.low ? 160000 : 900000) / (w * h)))); renderer.setSize(w, h, false); dirty = true; request(); }
  const observer = new ResizeObserver(resize); observer.observe(viewport);
  const onVisibility = () => { last = performance.now(); readyAt = last; if (!document.hidden) request(); };
  let placing=false;
  const skyTimer=setInterval(()=>{ if(active && !document.hidden) updateSky(); },60000);
  document.addEventListener("visibilitychange", onVisibility);
  const onContextLoss = (event) => { event.preventDefault(); callbacks.onFallback("El dispositivo interrumpió el mundo 3D. Puedes continuar en la vista ligera."); };
  renderer.domElement.addEventListener("webglcontextlost", onContextLoss);
  camera.position.set(160, space.eyeLevel(160, 505), 505); controls.target.set(160, Math.max(12, space.height(160, 165)) + 55, 165); referenceDistance = camera.position.distanceTo(controls.target); navigationSync = true; controls.update(); navigationSync = false; walkEye.copy(camera.position); resize(); request();
  return {
    ready: assetsReady, setPosts, focus, forward, bounds() { return space.queryBounds(camera.position.x + origin.x, camera.position.z + origin.z); },
    place(value=true) { placing=value; viewport.classList.toggle("world-placing",value); velocity=0; flight=null; return true; },
    move(x, z) { flight = null; camera.getWorldDirection(direction); direction.y = 0; direction.normalize(); delta.set(-direction.z * x + direction.x * z, 0, direction.x * x + direction.z * z); camera.position.add(delta); controls.target.add(delta); walkEye.copy(camera.position); dirty = true; request(); },
    focusCreature(id) { const index = map.creatures.findIndex((item) => item.id === id); if (index < 0) return; const point = space.beings((index % 6 + .5) * space.CHUNK, (Math.floor(index / 6) + .5) * space.CHUNK, posts).find((item) => item.species === index); if (point) focus(point.x, point.z); },
    refresh() { resize(); }, setActive(value) { active = value; controls.enabled = value; last = performance.now(); if (value) { dirty = true; request(); } },
    destroy() {
      if (destroyed) return; destroyed = true;
      viewport.removeEventListener("keydown",placeKey); clearInterval(skyTimer); if (frame) cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener("visibilitychange", onVisibility); controls.dispose(); renderer.domElement.removeEventListener("webglcontextlost", onContextLoss);
      scene.traverse((obj) => { obj.geometry?.dispose(); if (obj.material?.map && !textureCache.has(obj.userData.species?.id)) obj.material.map.dispose(); if (obj.material && !Array.isArray(obj.material)) obj.material.dispose(); });
      forest.dispose(); waterfalls.dispose(); groundMap.dispose(); groundMap.image = null;
      for (const texture of textureCache.values()) texture.dispose(); for (const geo of geometries) geo.dispose(); groundMaterial.dispose(); waterMaterial.dispose(); for (const mat of materials) mat.dispose();
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); accessible.remove(); textureCache.clear(); chunks.clear(); postNodes.clear(); creatureNodes.clear(); scene.clear(); geometries.length = 0; materials.length = 0; batches.length = 0; pickups.length = 0; posts = []; flight = null; alphaCache = new WeakMap();
    }
  };
}
