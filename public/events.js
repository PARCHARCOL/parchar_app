const agendaEscape = (value) => String(value || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const eventForm = document.querySelector("#event-filters");
const eventArea = document.querySelector("#event-area");
const eventStatus = document.querySelector("#event-status");
const eventResults = document.querySelector("#event-results");
let agendaToday = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
let agendaRequest = 0;
let agendaCategories = { musica: "Música", teatro: "Teatro y humor", cine: "Cine", danza: "Danza", arte: "Arte y exposiciones", literatura: "Literatura", talleres: "Talleres", charlas: "Charlas", ferias: "Ferias", familia: "Familia", deporte: "Deporte", otros: "Otros planes" };
const selectedAgendaCategory = new URLSearchParams(location.search).get("category");
const hasAgendaCategory = Object.hasOwn(agendaCategories, selectedAgendaCategory);
const categoryMenu = document.querySelector("#event-category-menu");
const categoryView = document.querySelector("#event-category-view");
categoryMenu.innerHTML = Object.entries(agendaCategories).map(([key, label], index) => `<a class="event-category-window event-window-${index % 6}" href="/events.html?category=${key}"><img class="event-window-scene" src="/assets/ui/event-scene-${key}.webp" alt="" ${index > 2 ? 'loading="lazy"' : 'fetchpriority="high"'} /><h2>${agendaEscape(label)}</h2><span class="event-window-arrow" aria-hidden="true">↗</span></a>`).join("");
document.querySelector("#event-explorer").hidden = hasAgendaCategory;
categoryView.hidden = !hasAgendaCategory;
if (hasAgendaCategory) {
  document.querySelector(".inner-top h1").textContent = agendaCategories[selectedAgendaCategory];
  document.title = `${agendaCategories[selectedAgendaCategory]} | Parchar`;
  const back = document.querySelector(".inner-top a");
  back.href = "/events.html";
  back.setAttribute("aria-label", "Volver a categorías");
}
let agendaRefreshTimer;
let agendaSyncRetries = 0;
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
      <div class="event-information">
        <p>${agendaEscape(event.description)}</p>
        ${event.endDate !== event.date ? `<p>Hasta el ${agendaEscape(agendaDateLabel(event.endDate))}</p>` : ""}
        ${event.address ? `<p>${agendaEscape(event.address)}</p>` : ""}
        <div class="event-actions"><a class="ghost-btn" href="${agendaEscape(event.sourceUrl)}" target="_blank" rel="noopener noreferrer">Fuente u organizador ↗</a>
        ${event.venue || event.address ? `<a class="route-btn" href="${agendaEscape(route.href)}" target="_blank" rel="noopener noreferrer">Cómo llegar</a>` : ""}</div>
        <p class="tiny">${agendaEscape(event.sourceName)} · Actualizado ${agendaEscape(new Date(event.updatedAt).toLocaleDateString("es-CO"))}</p>
        ${event.references?.length > 1 ? `<div class="event-references">${event.references.filter((r) => r.url !== event.sourceUrl).map((r) => `<a href="${agendaEscape(r.url)}" target="_blank" rel="noopener noreferrer">${agendaEscape(r.name)} ↗</a>`).join("")}</div>` : ""}
      </div>
    </article>`;
  };
  eventResults.innerHTML = Object.entries(agendaCategories).map(([category, label]) => {
    const group = items.filter((event) => event.category === category);
    if (!group.length) return "";
    return `<section class="event-category-section" aria-label="${agendaEscape(label)}"><div class="event-category-grid${group.length === 1 ? " event-group-single" : ""}">${group.map(card).join("")}</div></section>`;
  }).join("");
  eventResults.querySelectorAll("img").forEach((image) => image.addEventListener("error", () => { image.hidden = true; }));
}
async function loadAgenda() {
  clearTimeout(agendaRefreshTimer);
  const request = ++agendaRequest;
  eventStatus.textContent = "Consultando agenda…";
  const area = eventArea.value.trim();
  const params = new URLSearchParams({ date: agendaToday, category: selectedAgendaCategory, area });
  try {
    const response = await fetch(`/api/events?${params}`, { cache: "no-store" });
    const data = await response.json();
    if (request !== agendaRequest) return;
    if (!response.ok) throw new Error(data.error || "No pudimos consultar la agenda.");
    agendaCategories = data.categories;
    agendaToday = data.today;
    const sourceStatus = document.querySelector("#event-source-status");
    const sources = data.sync.sources || [];
    sourceStatus.innerHTML = sources.map((source) => `<li><a href="${agendaEscape(source.url)}" target="_blank" rel="noopener noreferrer">${agendaEscape(source.name)} ↗</a><span>${source.ok ? "Consultada" : "Sin actualizar en esta consulta"}</span></li>`).join("");
    renderAgenda(data.items);
    eventStatus.textContent = data.items.length ? `${data.items.length} ${data.items.length === 1 ? "evento hoy" : "eventos hoy"}${area ? ` en ${area}` : " en el Área Metropolitana"}` :
      `No hay eventos de esta categoría registrados para hoy${area ? ` en ${area}` : " en el Área Metropolitana"}. Puedes consultar otra zona. Las fuentes pueden no incluir toda la programación.`;
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
eventForm.addEventListener("submit", (event) => { event.preventDefault(); loadAgenda(); });
eventArea.addEventListener("search", loadAgenda);
if (hasAgendaCategory) loadAgenda();

if (!hasAgendaCategory) {
  const viewport = document.querySelector("#event-explorer-viewport");
  const stage = document.querySelector("#event-explorer-stage");
  const zoomOut = document.querySelector("#event-zoom-out");
  const zoomIn = document.querySelector("#event-zoom-in");
  let scale = 1;
  const layout = () => {
    categoryMenu.style.width = `${viewport.clientWidth}px`;
    categoryMenu.style.transform = `scale(${scale})`;
    stage.style.width = `${viewport.clientWidth * scale}px`;
    stage.style.height = `${categoryMenu.offsetHeight * scale}px`;
    document.querySelector("#event-zoom-level").value = `${Math.round(scale * 100)}%`;
    zoomOut.disabled = scale <= 0.75;
    zoomIn.disabled = scale >= 1.75;
  };
  zoomOut.addEventListener("click", () => { scale = Math.max(0.75, scale - 0.25); layout(); });
  zoomIn.addEventListener("click", () => { scale = Math.min(1.75, scale + 0.25); layout(); });
  document.querySelector("#event-zoom-reset").addEventListener("click", () => { scale = 1; layout(); viewport.scrollTo(0, 0); });
  new ResizeObserver(layout).observe(viewport);
  document.fonts.ready.then(layout);
  layout();
}
