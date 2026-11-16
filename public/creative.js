(() => {
  const $ = (selector) => document.querySelector(selector);
  const renderer = window.CreativeRender;
  const world = $("#wall-world"), viewport = $("#wall-viewport"), list = $("#wall-list");
  const editor = $("#wall-editor"), detail = $("#wall-detail"), canvas = $("#wall-drawing");
  let session = {}, mode = "canvas", items = [], current, strokes = [], redo = [], drawing, background = renderer.colors[0], color = renderer.colors[2], avatar = renderer.avatars[0], request = 0, timer;
  let liked = new Set(), before = "", submitting = false;
  function syncSession() {
    session = {};
    try { const saved = JSON.parse(localStorage.getItem("parchar_client_session") || "{}"); if (typeof saved?.token === "string" && saved.token) session = saved; } catch {}
    $("#wall-auth-note").hidden = !!session.token;
    $("#wall-publish").disabled = submitting;
  }
  syncSession();
  $(".wall-review-note").textContent = "Tu nombre público, texto y dibujo se envían a OpenAI para detectar contenido dañino antes de publicarse. No enviamos tu correo ni teléfono de la cuenta. Los casos dudosos pasan a revisión humana. No publiques datos personales ni contenido ajeno sin permiso.";
  const panzoom = Panzoom(world, { canvas: true, minScale: 0.2, maxScale: 2.5, origin: "0 0", startScale: 0.8, startX: -160, startY: -165, step: 0.25, overflow: "hidden" });
  viewport.addEventListener("wheel", panzoom.zoomWithWheel, { passive: false });
  async function api(path, options = {}) {
    syncSession();
    const response = await fetch(path, { ...options, cache: "no-store", headers: { "Content-Type": "application/json", ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}) } });
    const data = await response.json();
    if (response.status === 401) { try { localStorage.removeItem("parchar_client_session"); } catch {} syncSession(); }
    if (!response.ok) throw new Error(data.error || "No pudimos completar la operación."); return data;
  }
  function bounds() { const scale = panzoom.getScale(), pan = panzoom.getPan(); return new URLSearchParams({ x: -viewport.clientWidth / (2 * scale) - pan.x - 120, y: -viewport.clientHeight / (2 * scale) - pan.y - 120, w: Math.min(12000, viewport.clientWidth / scale + 240), h: Math.min(12000, viewport.clientHeight / scale + 240) }); }
  async function load(append = false) {
    append = append === true;
    const id = ++request; $("#wall-status").textContent = "Cargando muro…";
    try {
      const query = mode === "canvas" ? bounds() : new URLSearchParams({ view: "list", ...(append && before ? { before } : {}) });
      const data = await api(mode === "mine" ? "/api/creative/mine" : `/api/creative?${query}`);
      if (id !== request) return;
      items = append ? [...items, ...data.items] : data.items;
      before = data.before || "";
      if (!append) { world.replaceChildren(); list.replaceChildren(); }
      $("#wall-more").hidden = mode !== "list" || !data.more;
      const fragment = document.createDocumentFragment();
      for (const item of data.items) { const card = renderer.card(item, mode === "mine"); if (mode === "canvas") { card.style.left = `${item.x}px`; card.style.top = `${item.y}px`; } fragment.append(card); }
      (mode === "canvas" ? world : list).append(fragment);
      $("#wall-empty").hidden = mode !== "canvas" || items.length > 0;
      $("#wall-status").textContent = data.more && mode === "canvas" ? "Acércate para ver todas las creaciones de esta zona." : items.length ? `${items.length} ${items.length === 1 ? "creación" : "creaciones"}${mode === "canvas" ? " en esta zona" : ""}` : mode === "mine" ? "Todavía no tienes creaciones. Las enviadas aparecerán aquí con su estado." : "Todavía no hay creaciones publicadas en esta zona.";
    } catch (error) { if (id === request) $("#wall-status").textContent = error.message; }
  }
  function zoomChanged() { $("#wall-scale").value = `${Math.round(panzoom.getScale() * 100)}%`; clearTimeout(timer); timer = setTimeout(load, 250); }
  world.addEventListener("panzoomchange", zoomChanged);
  $("#wall-plus").onclick = () => panzoom.zoomIn(); $("#wall-minus").onclick = () => panzoom.zoomOut();
  $("#wall-home").onclick = () => panzoom.reset(); $("#wall-refresh").onclick = load;
  $("#wall-more").onclick = () => load(true);
  viewport.addEventListener("keydown", (event) => { const deltas = { ArrowLeft: [100, 0], ArrowRight: [-100, 0], ArrowUp: [0, 100], ArrowDown: [0, -100] }; if (event.target !== viewport || !deltas[event.key]) return; event.preventDefault(); const [x, y] = deltas[event.key]; panzoom.pan(x, y, { relative: true }); });
  document.querySelectorAll("[data-mode]").forEach((button) => button.onclick = () => { mode = button.dataset.mode; document.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b === button))); viewport.hidden = mode !== "canvas"; list.hidden = mode === "canvas"; $(".wall-zoom").hidden = mode !== "canvas"; load(); });
  function creation() { return { alias: $("#wall-alias").value.trim(), text: $("#wall-text").value.trim(), avatar, background, strokes, moderationConsent: true }; }
  function repaint() { renderer.draw(canvas, creation(), false); $("#wall-undo").disabled = !strokes.length; $("#wall-redo").disabled = !redo.length; }
  function swatches(target, values, selected, change) {
    const container = $(target); container.replaceChildren(); values.forEach((value, i) => { const button = document.createElement("button"); button.type = "button"; button.className = "wall-swatch"; button.style.background = value; const names = ["Morado", "Blanco", "Turquesa", "Dorado", "Rosa", "Azul"]; button.setAttribute("aria-label", names[i]); button.title = names[i]; button.setAttribute("aria-pressed", String(value === selected)); button.onclick = () => { change(value); container.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === button))); repaint(); }; container.append(button); });
  }
  swatches("#wall-colors", renderer.colors, color, (v) => { color = v; }); swatches("#wall-backgrounds", renderer.colors, background, (v) => { background = v; });
  renderer.avatars.forEach((value) => { const button = document.createElement("button"); button.type = "button"; button.className = `wall-avatar-icon avatar-${value}`; button.setAttribute("aria-label", `Avatar ${value}`); button.title = `Avatar ${value}`; button.setAttribute("aria-pressed", String(value === avatar)); button.textContent = "P"; button.onclick = () => { avatar = value; $("#wall-avatars").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === button))); }; $("#wall-avatars").append(button); });
  function openEditor() {
    syncSession();
    if (!$("#wall-alias").value) $("#wall-alias").value = (session.client?.fullName || "").split(" ")[0].slice(0, 24);
    editor.showModal(); repaint();
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
  function signInWithDraft(event) {
    syncSession(); if (session.token) return;
    event.preventDefault();
    try { localStorage.setItem("parchar_creative_draft_v1", JSON.stringify(creation())); location.assign("/clients.html?next=creative"); }
    catch { $("#wall-editor-status").textContent = "No se pudo conservar el borrador. Inicia sesión en otra pestaña y vuelve aquí para no perder tu creación."; }
  }
  $("#wall-publish").addEventListener("click", signInWithDraft);
  $("#wall-auth-note a").addEventListener("click", (event) => { syncSession(); if (session.token) { event.preventDefault(); return; } signInWithDraft(event); });
  $("#wall-editor-form").onsubmit = async (event) => { event.preventDefault(); syncSession(); if (!session.token) { signInWithDraft(event); return; } submitting = true; syncSession(); try { const payload = { ...creation(), strokes: strokes.map(({ color, width, points }) => ({ color, width, points })) }; const data = await api("/api/creative", { method: "POST", body: JSON.stringify(payload) }); $("#wall-editor-status").textContent = data.message; strokes = []; redo = []; $("#wall-text").value = ""; try { localStorage.removeItem("parchar_creative_draft_v1"); } catch {} repaint(); } catch (error) { $("#wall-editor-status").textContent = error.message; } finally { submitting = false; syncSession(); } };
  document.addEventListener("click", (event) => { const id = event.target.closest("[data-open]")?.dataset.open; if (!id) return; current = items.find((item) => item.id === id); if (!current) return; const card = renderer.card(current); card.querySelector("button").remove(); $("#wall-detail-content").replaceChildren(card); if (current.text) { const message = document.createElement("p"); message.textContent = current.text; $("#wall-detail-content").append(message); } $("#wall-detail-title").textContent = current.alias; $("#wall-delete").hidden = mode !== "mine"; $("#wall-like").hidden = mode === "mine"; $("#wall-report-open").hidden = mode === "mine"; $("#wall-like").setAttribute("aria-pressed", String(liked.has(id))); $("#wall-like").lastChild.textContent = liked.has(id) ? "Te gusta" : "Me gusta"; $("#wall-report-form").hidden = true; $("#wall-detail-status").textContent = mode === "mine" ? current.status : `${current.likes} apoyos`; detail.showModal(); });
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
})();
