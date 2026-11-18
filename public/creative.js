(() => {
  const $ = (selector) => document.querySelector(selector);
  const renderer = window.CreativeRender;
  const world = $("#wall-world"), viewport = $("#wall-viewport"), list = $("#wall-list");
  const postsLayer = document.createElement("div"); postsLayer.className = "wall-posts-layer"; world.append(postsLayer);
  const editor = $("#wall-editor"), detail = $("#wall-detail"), canvas = $("#wall-drawing");
  let session = {}, mode = "canvas", items = [], current, strokes = [], redo = [], drawing, background = renderer.colors[0], color = renderer.colors[2], avatar = renderer.avatars[0], request = 0, timer;
  let liked = new Set(), before = "", submitting = false;
  let found = new Set();
  try { const saved = JSON.parse(localStorage.getItem("parchar_world_found_v1") || "[]"); if (Array.isArray(saved)) found = new Set(saved.filter((id) => typeof id === "string").slice(-500)); } catch {}
  function syncSession() {
    session = {};
    try { const saved = JSON.parse(localStorage.getItem("parchar_client_session") || "{}"); if (typeof saved?.token === "string" && saved.token) session = saved; } catch {}
    $("#wall-auth-note").hidden = !!session.token;
    $("#wall-publish").disabled = submitting;
  }
  syncSession();
  $(".wall-review-note").textContent = "Tu nombre público, texto y dibujo se envían a OpenAI para detectar contenido dañino antes de publicarse. No enviamos tu correo ni teléfono de la cuenta. Los casos dudosos pasan a revisión humana. No publiques datos personales ni contenido ajeno sin permiso.";
  let creatureCatalog = [];
  let creatureAvatar = "", position = null;
  try { creatureAvatar = localStorage.getItem("parchar_world_avatar_v1") || ""; } catch {}
  const avatarPreview = document.createElement("img"); avatarPreview.className = "world-avatar-preview"; avatarPreview.hidden = true;
  const avatarName = document.createElement("span"); avatarName.setAttribute("role","status");
  const chooseAvatar = document.createElement("button"); chooseAvatar.type="button"; chooseAvatar.textContent="Elegir personaje";
  $(".wall-avatar").append(avatarPreview,avatarName,chooseAvatar);
  chooseAvatar.onclick=()=>{ if(creatureCatalog.length) showCreature(creatureCatalog.find((s)=>s.id===creatureAvatar)||creatureCatalog[0]); };
  const useAvatar=document.createElement("button"); useAvatar.type="button"; useAvatar.className="wall-primary"; useAvatar.textContent="Usar como mi avatar"; $("#world-creature-dialog").append(useAvatar);
  function syncAvatar() {
    const species=creatureCatalog.find((s)=>s.id===creatureAvatar);
    avatarPreview.hidden=!species; avatarName.textContent=species ? species.name : "";
    if(species){ avatarPreview.src=`/assets/creative-world/beings/${species.id}.webp`; avatarPreview.alt=species.name; const icon=$("#wall-fauna img"); icon.src=avatarPreview.src;icon.style.filter="none"; $("#wall-fauna").title=`Mi avatar: ${species.name}`;$("#wall-fauna").setAttribute("aria-label",`Mi avatar: ${species.name}`); }
  }
  useAvatar.onclick=()=>{ creatureAvatar=$("#world-species").value; try{localStorage.setItem("parchar_world_avatar_v1",creatureAvatar);}catch{} syncAvatar(); $("#world-creature-dialog").close(); };
  const placement=document.createElement("button"); placement.type="button"; placement.textContent="Elegir lugar en el mundo";
  const placementNote=document.createElement("p"); placementNote.setAttribute("role","status");
  $("#wall-editor-form").insertBefore(placement,$(".wall-review-note")); placement.after(placementNote);
  const placementBar=document.createElement("div"); placementBar.className="world-placement-bar"; placementBar.hidden=true;
  const placementStatus=document.createElement("span"); placementStatus.setAttribute("role","status");
  const cancelPlacement=document.createElement("button"); cancelPlacement.type="button"; cancelPlacement.textContent="Cancelar"; placementBar.append(placementStatus,cancelPlacement); viewport.append(placementBar);
  placement.onclick=()=>{ if(mode!=="canvas"){placementNote.textContent="Abre Mundo 3D para elegir un lugar. En vista ligera se asigna automáticamente.";return;} if(!scenery.place(true))return; editor.close(); viewport.focus(); placementBar.hidden=false; placementStatus.textContent="Toca tierra firme donde quieras dejar tu mensaje."; };
  cancelPlacement.onclick=()=>{scenery.place(false);placementBar.hidden=true;openEditor();};
  viewport.addEventListener("keydown",(event)=>{if(event.key==="Escape" && !placementBar.hidden)cancelPlacement.click();});
  function showCreature(species) {
    $("#world-find-creature").hidden=mode!=="canvas"||!["ciervo","zorro","unicornio"].includes(species.id);
    $("#world-species").value = species.id;
    $("#world-being-name").textContent = species.name;
    $("#world-being-image").src = `/assets/creative-world/beings/${species.id}.webp`;
    $("#world-being-image").alt = species.name;
    $("#world-being-description").textContent = species.description;
    scenery.setActive(false);
    if (!$("#world-creature-dialog").open) $("#world-creature-dialog").showModal();
  }
  const scenery = Creative3D.create(viewport, { onPlace: (point)=>{position=point;placementNote.textContent="Lugar elegido. Tu mensaje aparecerá allí cuando sea aprobado.";placementBar.hidden=true;openEditor();}, onPlaceError:(message)=>{placementStatus.textContent=message;}, onCreature: showCreature, onPost: (id) => openCreation(id), onMove: () => { if (mode !== "canvas") return; clearTimeout(timer); timer = setTimeout(load, 450); }, onFallback: (reason) => { placementBar.hidden=true; switchMode("list"); document.querySelector('[data-mode="canvas"]').disabled = true; const note = $("#world-light-note"); note.hidden = false; note.textContent = reason + " "; const retry = document.createElement("button"); retry.type = "button"; retry.textContent = "Reintentar 3D"; retry.onclick = () => { try { localStorage.removeItem("parchar_world_light_until_v1"); } catch {} location.reload(); }; note.append(retry); } });
  $("#wall-fauna").onclick = () => { if (creatureCatalog.length) showCreature(creatureCatalog.find((s)=>s.id===creatureAvatar)||creatureCatalog[0]); };
  $("#world-species").onchange = () => { const species = creatureCatalog.find((item) => item.id === $("#world-species").value); if (species) showCreature(species); };
  $("#world-find-creature").onclick = () => { $("#world-creature-dialog").close(); scenery.focusCreature($("#world-species").value); };
  const zoneSelect = $("#wall-zone");
  scenery.ready.then(async (map) => {
    if (!map) {
      try { const response=await fetch("/assets/creative-world/manifest.json?v=1"); if(!response.ok)return; const catalog=await response.json(); creatureCatalog=catalog.creatures||[]; for(const species of creatureCatalog)$("#world-species").add(new Option(species.name,species.id)); syncAvatar(); } catch {}
      return;
    }
    for (const zone of map.zones) zoneSelect.add(new Option(zone.name, zone.id));
    zoneSelect.disabled = false;
    creatureCatalog = map.creatures || [];
    if(!creatureCatalog.some((s)=>s.id===creatureAvatar))creatureAvatar="";
    syncAvatar();
    for (const species of creatureCatalog) $("#world-species").add(new Option(species.name, species.id));
    $("#wall-fauna").disabled = !creatureCatalog.length;
    zoneSelect.onchange = () => { const zone = map.zones.find((item) => item.id === zoneSelect.value); if (zone) scenery.focus(zone.x, zone.y); };
  });
  async function api(path, options = {}) {
    syncSession();
    const response = await fetch(path, { ...options, cache: "no-store", headers: { "Content-Type": "application/json", ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}) } });
    const data = await response.json();
    if (response.status === 401) { try { localStorage.removeItem("parchar_client_session"); } catch {} syncSession(); }
    if (!response.ok) throw new Error(data.error || "No pudimos completar la operación.");
    if(path==="/api/creative" && options.method==="POST"){position=null;placementNote.textContent="";}
    return data;
  }
  function bounds() { return new URLSearchParams(scenery.bounds()); }
  const zoneCache = new Map();
  let controller;
  async function load(append = false) {
    append = append === true;
    const id = ++request; $("#wall-status").textContent = "Cargando muro…";
    try {
      const query = mode === "canvas" ? bounds() : new URLSearchParams({ view: "list", ...(append && before ? { before } : {}) });
      const path = mode === "mine" ? "/api/creative/mine" : `/api/creative?${query}`;
      const cached = mode === "canvas" ? zoneCache.get(path) : null;
      controller?.abort(); controller = new AbortController();
      const data = cached && Date.now() - cached.at < 20000 ? cached.data : await api(path, { signal: controller.signal });
      if (id !== request) return;
      if (mode === "canvas" && (!cached || Date.now() - cached.at >= 20000)) { const size = JSON.stringify(data).length * 2; if (size <= 256000) { zoneCache.set(path, { at: Date.now(), data }); if (zoneCache.size > 8) zoneCache.delete(zoneCache.keys().next().value); } }
      items = append ? [...items, ...data.items] : data.items;
      before = data.before || "";
      if (!append) { postsLayer.replaceChildren(); list.replaceChildren(); }
      $("#wall-more").hidden = mode !== "list" || !data.more;
      const fragment = document.createDocumentFragment();
      if (mode === "canvas") scenery.setPosts(data.items);
      else { for (const item of data.items) fragment.append(renderer.card(item, mode === "mine")); list.append(fragment); }
      $("#wall-empty").hidden = mode !== "canvas" || items.length > 0;
      $("#wall-status").textContent = data.more && mode === "canvas" ? "Acércate para ver todas las creaciones de esta zona." : items.length ? `${items.length} ${items.length === 1 ? "creación" : "creaciones"}${mode === "canvas" ? " en esta zona" : ""}` : mode === "mine" ? "Todavía no tienes creaciones. Las enviadas aparecerán aquí con su estado." : "Todavía no hay creaciones publicadas en esta zona.";
    } catch (error) { if (error.name !== "AbortError" && id === request) $("#wall-status").textContent = error.message; }
  }
  $("#wall-plus").onclick = () => scenery.forward(500); $("#wall-minus").onclick = () => scenery.forward(-500);
  $("#wall-home").onclick = () => { scenery.reset(); zoneSelect.value = ""; }; $("#wall-refresh").onclick = () => { zoneCache.clear(); load(); };
  $("#wall-more").onclick = () => load(true);
  viewport.addEventListener("keydown", (event) => { const deltas = { ArrowLeft: [-100, 0], ArrowRight: [100, 0], ArrowUp: [0, 100], ArrowDown: [0, -100] }; if (event.target !== viewport || !deltas[event.key]) return; event.preventDefault(); scenery.move(...deltas[event.key]); });
  function switchMode(next) { mode = next; clearTimeout(timer); document.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode))); viewport.hidden = mode !== "canvas"; list.hidden = mode === "canvas"; $(".wall-zoom").hidden = mode !== "canvas"; scenery.setActive(mode === "canvas"); if (mode === "canvas") scenery.refresh(); load(); }
  document.querySelectorAll("[data-mode]").forEach((button) => button.onclick = () => switchMode(button.dataset.mode));
  function creation() { return { alias: $("#wall-alias").value.trim(), text: $("#wall-text").value.trim(), avatar, background, strokes, ...(creatureAvatar ? {creatureAvatar} : {}), ...(position ? {position} : {}), moderationConsent: true }; }
  function repaint() { renderer.draw(canvas, creation(), false); $("#wall-undo").disabled = !strokes.length; $("#wall-redo").disabled = !redo.length; }
  function swatches(target, values, selected, change) {
    const container = $(target); container.replaceChildren(); values.forEach((value, i) => { const button = document.createElement("button"); button.type = "button"; button.className = "wall-swatch"; button.style.background = value; const names = ["Morado", "Blanco", "Turquesa", "Dorado", "Rosa", "Azul"]; button.setAttribute("aria-label", names[i]); button.title = names[i]; button.setAttribute("aria-pressed", String(value === selected)); button.onclick = () => { change(value); container.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === button))); repaint(); }; container.append(button); });
  }
  swatches("#wall-colors", renderer.colors, color, (v) => { color = v; }); swatches("#wall-backgrounds", renderer.colors, background, (v) => { background = v; });
  renderer.avatars.forEach((value) => { const button = document.createElement("button"); button.type = "button"; button.className = `wall-avatar-icon avatar-${value}`; button.setAttribute("aria-label", `Avatar ${value}`); button.title = `Avatar ${value}`; button.setAttribute("aria-pressed", String(value === avatar)); button.textContent = "P"; button.onclick = () => { avatar = value; $("#wall-avatars").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === button))); }; $("#wall-avatars").append(button); });
  function openEditor() {
    syncSession();
    if (!$("#wall-alias").value) $("#wall-alias").value = (session.client?.fullName || "").split(" ")[0].slice(0, 24);
    scenery.setActive(false); editor.showModal(); repaint();
  }
  $("#wall-create").onclick = openEditor; $("#wall-empty-create").onclick = openEditor;
  document.querySelectorAll("[data-close]").forEach((b) => b.onclick = () => $("#" + b.dataset.close).close());
  const point = (event) => { const rect = canvas.getBoundingClientRect(); return [Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))]; };
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || drawing || strokes.length >= 120 || strokes.reduce((n, s) => n + s.points.length, 0) >= 3000) return;
    event.preventDefault(); canvas.setPointerCapture(event.pointerId); drawing = { color, width: Number($("#wall-width").value), points: [point(event)], pointer: event.pointerId }; strokes.push(drawing); redo = []; repaint();
  });
  canvas.addEventListener("pointermove", (event) => { if (!drawing || event.pointerId !== drawing.pointer) return; if (strokes.reduce((n, s) => n + s.points.length, 0) < 3000) drawing.points.push(point(event)); repaint(); });
  const finish = () => { drawing = null; }; canvas.addEventListener("pointerup", finish); canvas.addEventListener("pointercancel", finish); editor.addEventListener("close", finish);
  $("#wall-undo").onclick = () => { finish(); if (strokes.length) redo.push(strokes.pop()); repaint(); }; $("#wall-redo").onclick = () => { finish(); if (redo.length) strokes.push(redo.pop()); repaint(); };
  $("#wall-clear").onclick = () => { if (strokes.length && confirm("¿Borrar los trazos del dibujo?")) { strokes = []; redo = []; repaint(); } };
  $("#wall-draft").onclick = () => { try { localStorage.setItem("parchar_creative_draft_v1", JSON.stringify(creation())); $("#wall-editor-status").textContent = "Borrador guardado en este dispositivo."; } catch { $("#wall-editor-status").textContent = "No se pudo guardar el borrador en este dispositivo."; } };
  try { const draft = JSON.parse(localStorage.getItem("parchar_creative_draft_v1") || "null"); if (draft) { $("#wall-text").value = String(draft.text || "").slice(0, 280); $("#wall-alias").value = String(draft.alias || "").slice(0, 24); strokes = Array.isArray(draft.strokes) ? draft.strokes.slice(0, 120) : []; background = renderer.colors.includes(draft.background) ? draft.background : background; avatar = renderer.avatars.includes(draft.avatar) ? draft.avatar : avatar; swatches("#wall-backgrounds", renderer.colors, background, (v) => { background = v; }); $("#wall-avatars").querySelectorAll("button").forEach((b, i) => b.setAttribute("aria-pressed", String(renderer.avatars[i] === avatar))); } } catch {}
  try { const draft=JSON.parse(localStorage.getItem("parchar_creative_draft_v1")||"null"); if(draft){if(/^[a-z-]{2,24}$/.test(draft.creatureAvatar||""))creatureAvatar=draft.creatureAvatar; if(draft.position && [draft.position.x,draft.position.y].every((v)=>Number.isFinite(v)&&Math.abs(v)<=980000)){position=draft.position;placementNote.textContent="Lugar elegido en el borrador.";}} } catch {}
  function signInWithDraft(event) {
    syncSession(); if (session.token) return;
    event.preventDefault();
    try { localStorage.setItem("parchar_creative_draft_v1", JSON.stringify(creation())); location.assign("/clients.html?next=creative"); }
    catch { $("#wall-editor-status").textContent = "No se pudo conservar el borrador. Inicia sesión en otra pestaña y vuelve aquí para no perder tu creación."; }
  }
  $("#wall-publish").addEventListener("click", signInWithDraft);
  $("#wall-auth-note a").addEventListener("click", (event) => { syncSession(); if (session.token) { event.preventDefault(); return; } signInWithDraft(event); });
  $("#wall-editor-form").onsubmit = async (event) => { event.preventDefault(); syncSession(); if (!session.token) { signInWithDraft(event); return; } submitting = true; syncSession(); try { const payload = { ...creation(), strokes: strokes.map(({ color, width, points }) => ({ color, width, points })) }; const data = await api("/api/creative", { method: "POST", body: JSON.stringify(payload) }); $("#wall-editor-status").textContent = data.message; strokes = []; redo = []; $("#wall-text").value = ""; try { localStorage.removeItem("parchar_creative_draft_v1"); } catch {} repaint(); } catch (error) { $("#wall-editor-status").textContent = error.message; } finally { submitting = false; syncSession(); } };
  function openCreation(id) {
    current = items.find((item) => item.id === id); if (!current) return;
    if (mode === "canvas") { found.delete(id); found.add(id); found = new Set([...found].slice(-500)); try { localStorage.setItem("parchar_world_found_v1", JSON.stringify([...found])); } catch {} }
    const card = renderer.card(current); card.querySelector("button").remove(); $("#wall-detail-content").replaceChildren(card);
    if (current.text) { const message = document.createElement("p"); message.textContent = current.text; $("#wall-detail-content").append(message); }
    $("#wall-detail-title").textContent = current.alias; $("#wall-delete").hidden = mode !== "mine"; $("#wall-like").hidden = mode === "mine"; $("#wall-report-open").hidden = mode === "mine";
    $("#wall-like").setAttribute("aria-pressed", String(liked.has(id))); $("#wall-like").lastChild.textContent = liked.has(id) ? "Te gusta" : "Me gusta";
    $("#wall-report-form").hidden = true; $("#wall-detail-status").textContent = mode === "mine" ? current.status : `${current.likes} apoyos`; scenery.setActive(false); detail.showModal();
  }
  document.addEventListener("click", (event) => { const id = event.target.closest("[data-open]")?.dataset.open; if (id) openCreation(id); });
  detail.addEventListener("close", () => scenery.setActive(mode === "canvas"));
  editor.addEventListener("close", () => scenery.setActive(mode === "canvas"));
  $("#world-creature-dialog").addEventListener("close", () => scenery.setActive(mode === "canvas" && !editor.open && !detail.open));
  $("#wall-like").onclick = async () => { try { const value = !liked.has(current.id); await api(`/api/creative/${current.id}/like`, { method: "POST", body: JSON.stringify({ liked: value }) }); value ? liked.add(current.id) : liked.delete(current.id); $("#wall-like").setAttribute("aria-pressed", String(value)); $("#wall-detail-status").textContent = value ? "Apoyo registrado." : "Apoyo retirado."; } catch (error) { $("#wall-detail-status").textContent = error.message; } };
  $("#wall-delete").onclick = async () => { if (!confirm("¿Retirar esta creación del muro?")) return; try { await api(`/api/creative/${current.id}/delete`, { method: "POST", body: "{}" }); detail.close(); load(); } catch (error) { $("#wall-detail-status").textContent = error.message; } };
  $("#wall-report-open").onclick = () => { $("#wall-report-form").hidden = false; };
  $("#wall-report-form").onsubmit = async (event) => { event.preventDefault(); try { await api(`/api/creative/${current.id}/report`, { method: "POST", body: JSON.stringify({ reason: $("#wall-report-reason").value }) }); $("#wall-report-form").hidden = true; $("#wall-detail-status").textContent = "Reporte enviado al equipo de Parchar."; } catch (error) { $("#wall-detail-status").textContent = error.message; } };
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
  window.addEventListener("focus", syncSession);
  window.addEventListener("pageshow", syncSession);
  window.addEventListener("storage", (event) => { if (event.key === "parchar_client_session") syncSession(); });
  if (new URLSearchParams(location.search).get("editor") === "1") openEditor();
  load();
  window.addEventListener("pagehide", () => scenery.setActive(false));
  window.addEventListener("pageshow", () => scenery.setActive(mode === "canvas"));
})();
