const siteResultsEl = document.querySelector("#site-results");
const siteSearchForm = document.querySelector("#site-search-form");
const siteSearchInput = document.querySelector("#site-search");
const siteFilterButtons = document.querySelectorAll(".site-filter");

const siteTypeLabels = {
  charco: "Charco",
  mirador: "Mirador",
  pueblo: "Pueblo",
  naturaleza: "Naturaleza",
};

const openSites = [
  {
    name: "Charcos de San Rafael",
    type: "charco",
    city: "San Rafael, Antioquia",
    description:
      "Zona de rios y charcos naturales para planes de agua y naturaleza.",
    tags: ["Agua", "Naturaleza", "Dia completo"],
    query: "Charcos San Rafael Antioquia",
  },
  {
    name: "Rio Melcocho",
    type: "charco",
    city: "Oriente antioqueno",
    description:
      "Ruta natural con agua cristalina. Revisa acceso, clima y guias antes de ir.",
    tags: ["Rio", "Aventura", "Naturaleza"],
    query: "Rio Melcocho Antioquia",
  },
  {
    name: "Salto del Buey",
    type: "naturaleza",
    city: "Abejorral / La Ceja",
    description:
      "Cascada y plan de naturaleza para visitantes con experiencia al aire libre.",
    tags: ["Cascada", "Sendero", "Vista"],
    query: "Salto del Buey Antioquia",
  },
  {
    name: "Mirador Las Palmas",
    type: "mirador",
    city: "Envigado",
    description:
      "Mirador cercano al Valle de Aburra para ver la ciudad y hacer ruta corta.",
    tags: ["Vista", "Noche", "Cercano"],
    query: "Mirador Las Palmas Envigado",
  },
  {
    name: "Mirador San Felix",
    type: "mirador",
    city: "Bello",
    description:
      "Zona alta con vista, clima frio y planes de tarde o noche.",
    tags: ["Vista", "Parapente", "Frio"],
    query: "Mirador San Felix Bello Antioquia",
  },
  {
    name: "Guatape y Piedra del Penol",
    type: "pueblo",
    city: "Guatape",
    description:
      "Pueblo turistico, embalse, malecon y subida a la piedra.",
    tags: ["Pueblo", "Embalse", "Foto"],
    query: "Piedra del Penol Guatape",
  },
  {
    name: "Jardin",
    type: "pueblo",
    city: "Jardin, Antioquia",
    description:
      "Pueblo patrimonial con parque principal, cafe, miradores y naturaleza.",
    tags: ["Pueblo", "Cafe", "Miradores"],
    query: "Jardin Antioquia",
  },
  {
    name: "Santa Fe de Antioquia",
    type: "pueblo",
    city: "Santa Fe de Antioquia",
    description:
      "Plan de pueblo, arquitectura colonial y visita al Puente de Occidente.",
    tags: ["Pueblo", "Historia", "Calor"],
    query: "Santa Fe de Antioquia",
  },
  {
    name: "Jerico",
    type: "pueblo",
    city: "Jerico, Antioquia",
    description:
      "Pueblo de montana con miradores, cultura, cafe y calles para caminar.",
    tags: ["Pueblo", "Cultura", "Cafe"],
    query: "Jerico Antioquia",
  },
  {
    name: "San Carlos",
    type: "charco",
    city: "San Carlos, Antioquia",
    description:
      "Municipio conocido por charcos, rios y planes naturales.",
    tags: ["Agua", "Pueblo", "Naturaleza"],
    query: "San Carlos Antioquia charcos",
  },
];

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildGoogleRouteUrl(site) {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", site.query || site.name);
  return url.toString();
}

function buildWazeRouteUrl(site) {
  const url = new URL("https://waze.com/ul");
  url.searchParams.set("q", site.query || site.name);
  url.searchParams.set("navigate", "yes");
  url.searchParams.set("utm_source", "parchar");
  return url.toString();
}

function getInitialFilter() {
  const params = new URLSearchParams(window.location.search);
  const filter = normalizeText(
    params.get("filter") || params.get("type") || params.get("tipo")
  );

  if (filter && (filter === "todos" || siteTypeLabels[filter])) {
    return filter;
  }

  return "todos";
}

function getSearchFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get("q") || "").trim();
}

function setActiveFilter(filter) {
  siteFilterButtons.forEach((button) => {
    const isActive = button.dataset.siteFilter === filter;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function matchesSite(site, query, filter) {
  if (filter !== "todos" && site.type !== filter) {
    return false;
  }

  if (!query) {
    return true;
  }

  const haystack = normalizeText(
    [
      site.name,
      site.type,
      site.city,
      site.description,
      ...(site.tags || []),
    ].join(" ")
  );

  return normalizeText(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

function renderSiteCard(site) {
  const googleUrl = buildGoogleRouteUrl(site);
  const wazeUrl = buildWazeRouteUrl(site);
  const tags = (site.tags || [])
    .map((tag) => `<span>${escapeHtml(tag)}</span>`)
    .join("");

  return `
    <article class="place-card site-card">
      <header>
        <p class="chip">${escapeHtml(siteTypeLabels[site.type] || site.type)}</p>
        <h3>${escapeHtml(site.name)}</h3>
      </header>

      <p>
        <strong>Zona:</strong>
        ${escapeHtml(site.city)}
      </p>

      <p>${escapeHtml(site.description)}</p>

      <div class="site-tags">${tags}</div>

      <div class="distance-line site-route-line">
        <span>
          <strong>Ruta:</strong>
          Abre el mapa para llegar al sitio.
        </span>

        <details class="route-menu">
          <summary class="route-btn">Ir</summary>
          <div class="route-options">
            <a href="${escapeHtml(googleUrl)}" target="_blank" rel="noopener noreferrer">
              Google Maps
            </a>
            <a href="${escapeHtml(wazeUrl)}" target="_blank" rel="noopener noreferrer">
              Waze
            </a>
          </div>
        </details>
      </div>
    </article>
  `;
}

function renderSites() {
  if (!siteResultsEl) return;

  const activeFilter =
    document.querySelector(".site-filter.active")?.dataset.siteFilter ||
    getInitialFilter();
  const query = siteSearchInput?.value || "";
  const filteredSites = openSites.filter((site) =>
    matchesSite(site, query, activeFilter)
  );

  if (!filteredSites.length) {
    siteResultsEl.innerHTML = `
      <article class="empty-card">
        <h3>No encontramos sitios con ese filtro.</h3>
        <p>Prueba con charco, mirador, pueblo, rio, cascada o naturaleza.</p>
      </article>
    `;
    return;
  }

  siteResultsEl.innerHTML = filteredSites.map(renderSiteCard).join("");
}

function setupSiteSearch() {
  if (siteSearchInput) {
    siteSearchInput.value = getSearchFromUrl();
  }

  siteSearchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    renderSites();
  });

  siteSearchInput?.addEventListener("input", () => {
    renderSites();
  });
}

function setupSiteFilters() {
  const initialFilter = getInitialFilter();
  setActiveFilter(initialFilter);

  siteFilterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveFilter(button.dataset.siteFilter || "todos");
      renderSites();
    });
  });
}

setupSiteSearch();
setupSiteFilters();
renderSites();
