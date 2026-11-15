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
let agendaRefreshTimer;
let agendaSyncRetries = 0;
function datePlus(date, days) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
function agendaDateLabel(date) { return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00Z`)); }
function renderAgenda(items) {
  const card = (event, index) => {
    const route = new URL("https://www.google.com/maps/search/");
    route.searchParams.set("api", "1");
    route.searchParams.set("query", `${event.venue} ${event.address} ${event.city}`);
    return `<article class="place-card event-card${index === 0 ? " event-card-featured" : ""}${index % 3 === 1 ? " event-card-light" : ""}" data-event-category="${agendaEscape(event.category)}">
      ${event.image ? `<img class="event-photo" src="${agendaEscape(event.image)}" alt="" loading="lazy" />` : `<div class="event-artwork"><img src="/assets/ui/calendar-days.svg" alt="" /><span>${agendaEscape(agendaCategories[event.category])}</span><h3>${agendaEscape(event.name)}</h3></div>`}
      <div class="event-card-date"><strong>${agendaEscape(agendaDateLabel(event.date))}${event.endDate !== event.date ? ` – ${agendaEscape(agendaDateLabel(event.endDate))}` : ""}</strong></div>
      ${event.image ? `<h3>${agendaEscape(event.name)}</h3>` : ""}
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
        ${event.references?.length > 1 ? `<div class="event-references">${event.references.filter((r) => r.url !== event.sourceUrl).map((r) => `<a href="${agendaEscape(r.url)}" target="_blank" rel="noopener noreferrer">${agendaEscape(r.name)} ↗</a>`).join("")}</div>` : ""}
      </div></details>
    </article>`;
  };
  eventResults.innerHTML = Object.entries(agendaCategories).map(([category, label]) => {
    const group = items.filter((event) => event.category === category);
    if (!group.length) return "";
    return `<section class="event-category-section" aria-labelledby="agenda-${agendaEscape(category)}"><header class="event-category-heading"><h2 id="agenda-${agendaEscape(category)}">${agendaEscape(label)}</h2><span>${group.length} ${group.length === 1 ? "plan" : "planes"}</span></header><div class="event-category-grid${group.length === 1 ? " event-group-single" : ""}">${group.map(card).join("")}</div></section>`;
  }).join("");
  eventResults.querySelectorAll("img").forEach((image) => image.addEventListener("error", () => { image.hidden = true; }));
}
async function loadAgenda() {
  clearTimeout(agendaRefreshTimer);
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
    if (!eventDate.value) eventDate.value = agendaToday;
    const sourceStatus = document.querySelector("#event-source-status");
    const sources = data.sync.sources || [];
    sourceStatus.innerHTML = sources.map((source) => `<li><a href="${agendaEscape(source.url)}" target="_blank" rel="noopener noreferrer">${agendaEscape(source.name)} ↗</a><span>${source.ok ? "Consultada" : "Sin actualizar en esta consulta"}</span></li>`).join("");
    renderAgenda(data.items);
    eventStatus.textContent = data.items.length ? `${data.items.length} ${data.items.length === 1 ? "evento" : "eventos"}${eventCity.value ? ` en ${eventCity.value}` : " en el Área Metropolitana"}` :
      `Sin resultados en las fuentes consultadas${eventCity.value ? ` para ${eventCity.value}` : " para el Área Metropolitana"} en estas fechas. Prueba Próximos 7 días u otro municipio. Esto no significa que no haya actividades en la ciudad.`;
    if ((data.sync.running || !data.sync.updatedAt) && agendaSyncRetries < 24) {
      agendaSyncRetries++;
      eventStatus.textContent = "Actualizando la agenda desde las fuentes. Los resultados aparecerán aquí al terminar…";
      agendaRefreshTimer = setTimeout(loadAgenda, 5000);
    } else {
      agendaRefreshTimer = setTimeout(loadAgenda, 5 * 60 * 1000);
    }
    if (data.sync.errorAt && (!data.sync.updatedAt || data.sync.errorAt > data.sync.updatedAt)) eventStatus.textContent += " No se pudo actualizar la fuente; consulta la fecha de actualización de cada evento.";
  } catch (error) {
    if (request !== agendaRequest) return;
    eventResults.innerHTML = "";
    eventStatus.textContent = `${error.message} Intenta buscar de nuevo.`;
  }
}
eventDate.value = agendaToday;
const agendaMobileQuery = matchMedia("(max-width: 699px)");
const setAgendaFilterLayout = () => { document.querySelector("#event-advanced").open = !agendaMobileQuery.matches; };
setAgendaFilterLayout();
if (agendaMobileQuery.addEventListener) agendaMobileQuery.addEventListener("change", setAgendaFilterLayout);
else agendaMobileQuery.addListener(setAgendaFilterLayout);
eventForm.addEventListener("submit", (event) => { event.preventDefault(); loadAgenda(); });
eventDate.addEventListener("change", () => { agendaUntil = ""; document.querySelectorAll("[data-event-date]").forEach((b) => { b.classList.remove("active"); b.setAttribute("aria-pressed", "false"); }); });
document.querySelectorAll("[data-event-date]").forEach((button) => button.addEventListener("click", () => {
  const mode = button.dataset.eventDate;
  const day = new Date(`${agendaToday}T12:00:00Z`).getUTCDay();
  eventDate.value = mode === "tomorrow" ? datePlus(agendaToday, 1) : mode === "weekend" ? datePlus(agendaToday, day === 0 || day === 6 ? 0 : 6 - day) : agendaToday;
  agendaUntil = mode === "weekend" ? datePlus(eventDate.value, day === 0 ? 0 : 1) : mode === "week" ? datePlus(agendaToday, 6) : "";
  document.querySelectorAll("[data-event-date]").forEach((b) => { b.classList.toggle("active", b === button); b.setAttribute("aria-pressed", String(b === button)); });
  loadAgenda();
}));
loadAgenda();
