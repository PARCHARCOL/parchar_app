const agendaEscape = (value) => String(value || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const eventForm = document.querySelector("#event-filters");
const eventDate = document.querySelector("#event-date");
const eventCity = document.querySelector("#event-city");
const eventCategory = document.querySelector("#event-category");
const eventStatus = document.querySelector("#event-status");
const eventResults = document.querySelector("#event-results");
let agendaToday = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
let agendaUntil = "";
let agendaRequest = 0;
let agendaCategories = {};
function datePlus(date, days) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
function agendaDateLabel(date) { return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00Z`)); }
function renderAgenda(items) {
  eventResults.innerHTML = items.map((event) => {
    const route = new URL("https://www.google.com/maps/search/");
    route.searchParams.set("api", "1");
    route.searchParams.set("query", `${event.venue} ${event.address} ${event.city}`);
    return `<article class="place-card event-card">
      <div class="event-card-date"><strong>${agendaEscape(agendaDateLabel(event.date))}</strong><span>${agendaEscape(agendaCategories[event.category] || "Evento")}</span></div>
      ${event.image ? `<img class="event-photo" src="${agendaEscape(event.image)}" alt="" loading="lazy" />` : ""}
      <h2>${agendaEscape(event.name)}</h2>
      <p><strong>${agendaEscape(event.city)}</strong> · ${agendaEscape(event.time)}</p>
      ${event.venue ? `<p>${agendaEscape(event.venue)}</p>` : ""}
      <p>${agendaEscape(event.price)}</p>
      <details class="place-more"><summary>Ver detalles</summary><div class="place-more-content">
        <p>${agendaEscape(event.description)}</p>
        ${event.endDate !== event.date ? `<p>Hasta el ${agendaEscape(agendaDateLabel(event.endDate))}</p>` : ""}
        ${event.address ? `<p>${agendaEscape(event.address)}</p>` : ""}
        <div class="event-actions"><a class="ghost-btn" href="${agendaEscape(event.sourceUrl)}" target="_blank" rel="noopener noreferrer">Fuente u organizador ↗</a>
        ${event.venue || event.address ? `<a class="route-btn" href="${agendaEscape(route.href)}" target="_blank" rel="noopener noreferrer">Cómo llegar</a>` : ""}</div>
        <p class="tiny">${agendaEscape(event.sourceName)} · Actualizado ${agendaEscape(new Date(event.updatedAt).toLocaleDateString("es-CO"))}</p>
      </div></details>
    </article>`;
  }).join("");
  eventResults.querySelectorAll("img").forEach((image) => image.addEventListener("error", () => { image.hidden = true; }));
}
async function loadAgenda() {
  const request = ++agendaRequest;
  eventStatus.textContent = "Consultando agenda…";
  const params = new URLSearchParams({ date: eventDate.value, city: eventCity.value, category: eventCategory.value, q: document.querySelector("#event-search").value });
  if (agendaUntil) params.set("until", agendaUntil);
  try {
    const response = await fetch(`/api/events?${params}`, { cache: "no-store" });
    const data = await response.json();
    if (request !== agendaRequest) return;
    if (!response.ok) throw new Error(data.error || "No pudimos consultar la agenda.");
    if (!Object.keys(agendaCategories).length) {
      agendaCategories = data.categories;
      for (const city of data.cities) eventCity.add(new Option(city, city));
      for (const [key, label] of Object.entries(data.categories)) eventCategory.add(new Option(label, key));
    }
    agendaToday = data.today;
    renderAgenda(data.items);
    eventStatus.textContent = data.items.length ? `${data.items.length} ${data.items.length === 1 ? "evento" : "eventos"}${eventCity.value ? ` en ${eventCity.value}` : " en el Área Metropolitana"}` :
      `No encontramos eventos publicados${eventCity.value ? ` en ${eventCity.value}` : " para esta zona"} en la fecha seleccionada. Puedes consultar otro día o municipio.`;
    if (data.sync.errorAt && (!data.sync.updatedAt || data.sync.errorAt > data.sync.updatedAt)) eventStatus.textContent += " No se pudo actualizar la fuente; consulta la fecha de actualización de cada evento.";
  } catch (error) {
    if (request !== agendaRequest) return;
    eventResults.innerHTML = "";
    eventStatus.textContent = `${error.message} Intenta buscar de nuevo.`;
  }
}
eventDate.value = agendaToday;
eventForm.addEventListener("submit", (event) => { event.preventDefault(); loadAgenda(); });
eventDate.addEventListener("change", () => { agendaUntil = ""; document.querySelectorAll("[data-event-date]").forEach((b) => { b.classList.remove("active"); b.setAttribute("aria-pressed", "false"); }); });
document.querySelectorAll("[data-event-date]").forEach((button) => button.addEventListener("click", () => {
  const mode = button.dataset.eventDate;
  const day = new Date(`${agendaToday}T12:00:00Z`).getUTCDay();
  eventDate.value = mode === "tomorrow" ? datePlus(agendaToday, 1) : mode === "weekend" ? datePlus(agendaToday, day === 0 || day === 6 ? 0 : 6 - day) : agendaToday;
  agendaUntil = mode === "weekend" ? datePlus(eventDate.value, day === 0 ? 0 : 1) : "";
  document.querySelectorAll("[data-event-date]").forEach((b) => { b.classList.toggle("active", b === button); b.setAttribute("aria-pressed", String(b === button)); });
  loadAgenda();
}));
loadAgenda();
