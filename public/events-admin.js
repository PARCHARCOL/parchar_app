(() => {
  const panel = document.querySelector("#admin-events-section");
  const form = document.querySelector("#events-admin-form");
  const status = document.querySelector("#events-admin-status");
  const list = document.querySelector("#events-admin-list");
  let items = [];
  let today = "";
  const esc = (v) => String(v || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  async function request(path = "", body) {
    const session = JSON.parse(localStorage.getItem("parchar_staff_session") || "{}");
    const response = await fetch(`/api/admin/events${path}`, { method: body ? "POST" : "GET", cache: "no-store", headers: { Authorization: `Bearer ${session.token || ""}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo completar la operación.");
    return data;
  }
  function render() {
    const filter = document.querySelector("#events-admin-filter").value;
    const selected = items.filter((e) => filter === "all" || (filter === "pausado" ? e.status === "pausado" : e.endDate >= today));
    list.innerHTML = selected.length ? selected.map((e) => `<article class="glass-card admin-card">
      <h3>${esc(e.name)}</h3><p>${esc(e.date)} · ${esc(e.city)} · ${e.status === "activo" ? "Publicado" : "Pausado"}</p>
      <p>${esc(e.sourceName)} · ${e.sourceKind === "automatico" ? "Carga automática" : "Edición del equipo"}</p>
      <div class="event-actions"><button type="button" class="ghost-btn" data-event-edit="${esc(e.id)}">Editar</button><button type="button" class="ghost-btn" data-event-status="${esc(e.id)}">${e.status === "activo" ? "Pausar" : "Publicar"}</button><a href="${esc(e.sourceUrl)}" target="_blank" rel="noopener noreferrer">Consultar fuente ↗</a></div>
    </article>`).join("") : "<p>No hay eventos en este filtro.</p>";
  }
  async function load() {
    try {
      const data = await request();
      items = data.items; today = data.today;
      const city = form.elements.city.value;
      const category = form.elements.category.value;
      form.elements.city.replaceChildren(...data.cities.map((c) => new Option(c, c)));
      form.elements.category.replaceChildren(...Object.entries(data.categories).map(([key, label]) => new Option(label, key)));
      if (city) form.elements.city.value = city;
      if (category) form.elements.category.value = category;
      status.textContent = `${data.sync.message} ${data.sync.updatedAt ? `Última consulta: ${new Date(data.sync.updatedAt).toLocaleString("es-CO")}` : ""}`;
      render();
    } catch (error) { status.textContent = error.message; }
  }
  document.querySelector('[data-admin-section-tab="events"]').addEventListener("click", load);
  document.querySelector("#events-refresh").addEventListener("click", load);
  document.querySelector("#events-admin-filter").addEventListener("change", render);
  document.querySelector("#events-sync").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true; status.textContent = "Consultando las fuentes…";
    try { await request("/sync", {}); await load(); } catch (error) { status.textContent = error.message; } finally { button.disabled = false; }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]'); button.disabled = true;
    try { await request("", Object.fromEntries(new FormData(form))); form.reset(); form.elements.id.value = ""; await load(); status.textContent = "Evento guardado."; } catch (error) { status.textContent = error.message; } finally { button.disabled = false; }
  });
  form.addEventListener("reset", () => { form.elements.id.value = ""; });
  panel.addEventListener("click", async (event) => {
    const edit = event.target.closest("[data-event-edit]");
    const toggle = event.target.closest("[data-event-status]");
    if (edit) {
      const item = items.find((e) => e.id === edit.dataset.eventEdit);
      for (const [key, value] of Object.entries(item)) if (form.elements.namedItem(key)) form.elements.namedItem(key).value = value || "";
      form.closest("details").open = true; form.elements.name.focus();
    }
    if (toggle) {
      const item = items.find((e) => e.id === toggle.dataset.eventStatus);
      toggle.disabled = true;
      try { await request("/status", { id: item.id, status: item.status === "activo" ? "pausado" : "activo" }); await load(); } catch (error) { status.textContent = error.message; toggle.disabled = false; }
    }
  });
})();
