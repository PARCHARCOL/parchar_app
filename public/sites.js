const siteResultsEl = document.querySelector("#site-results");
const siteSearchForm = document.querySelector("#site-search-form");
const siteSearchInput = document.querySelector("#site-search");
const siteFilterContainer = document.querySelector(".category-chips");
let siteFilterButtons = document.querySelectorAll(".site-filter");
const siteLocationStatus = document.querySelector("#site-location-status");
const siteLocationButton = document.querySelector("#site-location-btn");
const sitePageTitle = document.querySelector("#site-page-title");
const sitePageSubtitle = document.querySelector("#site-page-subtitle");

const siteTypeLabels = {
  charco: "Charco",
  cicloruta: "Cicloruta",
  mirador: "Mirador",
  parada_ciclista: "Parada ciclista",
  parque: "Parque",
  pueblo: "Pueblo",
  naturaleza: "Naturaleza",
  ruta_pueblo: "Ruta a pueblo",
  ruta_moto: "Ruta a pueblo",
  ruta_bici: "Ruta en bici",
};

const defaultSiteFilters = [
  ["todos", "Todos"],
  ["charco", "Charcos"],
  ["mirador", "Miradores"],
  ["pueblo", "Pueblos"],
  ["naturaleza", "Naturaleza"],
];

const bikeSiteFilters = [
  ["todos", "Todos"],
  ["cicloruta", "Ciclorutas"],
  ["ruta_bici", "Rutas bici"],
  ["parada_ciclista", "Paradas"],
  ["mirador", "Miradores"],
  ["parque", "Parques"],
];

const puebliarSiteFilters = [
  ["todos", "Todos"],
  ["pueblo", "Pueblos"],
  ["mirador", "Miradores"],
  ["rutas_pueblo", "Rutas"],
  ["naturaleza", "Naturaleza"],
];

const bikeSiteTypes = new Set([
  "cicloruta",
  "ruta_bici",
  "parada_ciclista",
]);

const puebliarSiteTypes = new Set([
  "ruta_pueblo",
  "ruta_moto",
  "pueblo",
]);

const bikeOptionalTypes = new Set([
  "mirador",
  "parque",
  "naturaleza",
  "charco",
  "pueblo",
]);

const puebliarOptionalTypes = new Set([
  "mirador",
  "naturaleza",
]);

const bikeKeywords = [
  "bici",
  "bicicleta",
  "bicicletas",
  "cicloruta",
  "ciclorutas",
  "ciclista",
  "ciclistas",
  "pedal",
  "pedaleo",
  "mtb",
];

const puebliarKeywords = [
  "pueblo",
  "pueblos",
  "puebliar",
  "escapada",
  "escapadas",
  "ruta",
  "rutas",
  "moto",
  "motos",
  "motero",
  "motera",
  "rodada",
  "mirador",
];

const internalPublicSiteTags = new Set([
  "importado",
  "revisar",
  "revision",
  "pendiente",
]);

let openSites = [];
let userCoords = null;
let locationResolved = false;
const weatherIconCache =
  new Map();
let weatherIconObserver = null;

function isBikeMode() {
  const params = new URLSearchParams(window.location.search);
  return normalizeText(params.get("mode")) === "bike";
}

function isPuebliarMode() {
  const params = new URLSearchParams(window.location.search);
  const mode = normalizeText(params.get("mode"));
  return mode === "puebliar" || mode === "moto";
}

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

function isValidCoordinate(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function calculateDistanceKm(origin, site) {
  if (
    !origin ||
    !isValidCoordinate(
      Number(site.latitude),
      Number(site.longitude)
    )
  ) {
    return null;
  }

  const earthRadiusKm = 6371;
  const toRadians = (value) =>
    (value * Math.PI) / 180;
  const lat1 = toRadians(origin.latitude);
  const lat2 = toRadians(Number(site.latitude));
  const deltaLat = toRadians(
    Number(site.latitude) - origin.latitude
  );
  const deltaLng = toRadians(
    Number(site.longitude) - origin.longitude
  );
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) ** 2;
  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadiusKm * c;
}

function formatDistance(km) {
  if (km === null || km === undefined) {
    return "";
  }

  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }

  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

function formatMinutes(minutes) {
  if (!Number.isFinite(minutes)) {
    return "";
  }

  if (minutes < 60) {
    return `${Math.max(1, Math.round(minutes))} min`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);

  return rest
    ? `${hours} h ${rest} min`
    : `${hours} h`;
}

function estimateTravelText(km) {
  if (km === null || km === undefined) {
    return "Permite ubicacion para calcular distancia.";
  }

  if (isBikeMode()) {
    const bikeMinutes = (km / 14) * 60;
    return `A ${formatDistance(km)} de ti - En bici aprox ${formatMinutes(bikeMinutes)}`;
  }

  if (isPuebliarMode()) {
    const driveMinutes = (km / 32) * 60;
    return `A ${formatDistance(km)} de ti - En ruta aprox ${formatMinutes(driveMinutes)}`;
  }

  const driveMinutes = (km / 28) * 60;
  const parts = [
    `A ${formatDistance(km)} de ti`,
    `En vehiculo aprox ${formatMinutes(driveMinutes)}`,
  ];

  if (km <= 3) {
    const walkMinutes = (km / 4.5) * 60;
    parts.push(
      `A pie aprox ${formatMinutes(walkMinutes)}`
    );
  }

  return parts.join(" - ");

  return parts.join(" · ");
}

function buildGoogleRouteUrl(site) {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");

  if (userCoords) {
    url.searchParams.set(
      "origin",
      `${userCoords.latitude},${userCoords.longitude}`
    );
  }

  url.searchParams.set(
    "destination",
    `${site.latitude},${site.longitude}`
  );
  url.searchParams.set(
    "travelmode",
    isBikeMode() ? "bicycling" : "driving"
  );
  return url.toString();
}

function buildWazeRouteUrl(site) {
  const url = new URL("https://waze.com/ul");
  url.searchParams.set(
    "ll",
    `${site.latitude},${site.longitude}`
  );
  url.searchParams.set("navigate", "yes");
  url.searchParams.set("utm_source", "parchar");
  return url.toString();
}

function getWeatherKey(site) {
  const latitude =
    Number(site.latitude);
  const longitude =
    Number(site.longitude);

  if (
    !isValidCoordinate(
      latitude,
      longitude
    )
  ) {
    return "";
  }

  return `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
}

function renderWeatherIcon(site) {
  const key = getWeatherKey(site);

  if (!key) {
    return "";
  }

  const [latitude, longitude] =
    key.split(",");

  return `
    <span
      class="weather-icon is-loading"
      data-weather-lat="${escapeHtml(latitude)}"
      data-weather-lng="${escapeHtml(longitude)}"
      aria-label="Cargando clima actual"
      title="Clima actual"
    ></span>
  `;
}

function getClientWeatherIcon(code, isDay = true) {
  if (code === 0) {
    return isDay ? "☀️" : "🌙";
  }

  if ([1, 2].includes(code)) {
    return isDay ? "🌤️" : "☁️";
  }

  if (code === 3) {
    return "☁️";
  }

  if ([45, 48].includes(code)) {
    return "🌫️";
  }

  if (
    [
      51, 53, 55, 56, 57, 61, 63, 65, 66, 67,
      80, 81, 82,
    ].includes(code)
  ) {
    return "🌧️";
  }

  if (
    [71, 73, 75, 77, 85, 86].includes(
      code
    )
  ) {
    return "❄️";
  }

  if ([95, 96, 99].includes(code)) {
    return "⛈️";
  }

  return "🌡️";
}

function getClientWeatherLabel(code) {
  if (code === 0) {
    return "despejado";
  }

  if ([1, 2].includes(code)) {
    return "parcialmente nublado";
  }

  if (code === 3) {
    return "nublado";
  }

  if ([45, 48].includes(code)) {
    return "neblina";
  }

  if ([51, 53, 55, 56, 57].includes(code)) {
    return "llovizna";
  }

  if (
    [61, 63, 65, 66, 67, 80, 81, 82].includes(
      code
    )
  ) {
    return "lluvia";
  }

  if (
    [71, 73, 75, 77, 85, 86].includes(
      code
    )
  ) {
    return "nieve";
  }

  if ([95, 96, 99].includes(code)) {
    return "tormenta";
  }

  return "clima disponible";
}

function normalizeOpenMeteoWeather(data) {
  const code = Number(
    data.current?.weather_code
  );

  if (!Number.isFinite(code)) {
    throw new Error(
      "Clima no disponible."
    );
  }

  const isDay =
    Number(data.current?.is_day) !==
    0;

  return {
    code,
    icon:
      getClientWeatherIcon(
        code,
        isDay
      ),
    label:
      getClientWeatherLabel(code),
    isDay,
    observedAt:
      data.current?.time || null,
  };
}

async function fetchWeatherForCoords(
  latitude,
  longitude
) {
  try {
    const response = await fetch(
      `/api/weather/current?lat=${encodeURIComponent(
        String(latitude)
      )}&lng=${encodeURIComponent(
        String(longitude)
      )}`
    );
    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "Clima no disponible."
      );
    }

    return data.weather;
  } catch {
    const url =
      new URL(
        "https://api.open-meteo.com/v1/forecast"
      );
    url.searchParams.set(
      "latitude",
      String(latitude)
    );
    url.searchParams.set(
      "longitude",
      String(longitude)
    );
    url.searchParams.set(
      "current",
      "weather_code,is_day"
    );
    url.searchParams.set(
      "timezone",
      "auto"
    );
    url.searchParams.set(
      "forecast_days",
      "1"
    );

    const response =
      await fetch(url.toString());
    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        "Clima no disponible."
      );
    }

    return normalizeOpenMeteoWeather(
      data
    );
  }
}

function applyWeatherIcon(element, weather) {
  if (!weather?.icon) {
    element.classList.add(
      "is-unavailable"
    );
    return;
  }

  const label =
    weather.label ||
    "clima actual";
  element.textContent =
    weather.icon;
  element.classList.remove(
    "is-loading"
  );
  element.setAttribute(
    "aria-label",
    `Clima actual: ${label}`
  );
  element.title =
    `Clima actual: ${label}`;
}

async function loadWeatherIcon(element) {
  if (
    element.dataset.weatherLoaded ===
    "true"
  ) {
    return;
  }

  element.dataset.weatherLoaded =
    "true";
  const latitude =
    Number(element.dataset.weatherLat);
  const longitude =
    Number(element.dataset.weatherLng);

  if (
    !isValidCoordinate(
      latitude,
      longitude
    )
  ) {
    element.classList.add(
      "is-unavailable"
    );
    return;
  }

  const key = `${latitude.toFixed(
    3
  )},${longitude.toFixed(3)}`;

  if (weatherIconCache.has(key)) {
    applyWeatherIcon(
      element,
      weatherIconCache.get(key)
    );
    return;
  }

  try {
    const weather =
      await fetchWeatherForCoords(
        latitude,
        longitude
      );

    weatherIconCache.set(
      key,
      weather
    );
    applyWeatherIcon(
      element,
      weather
    );
  } catch {
    element.classList.add(
      "is-unavailable"
    );
  }
}

function hydrateWeatherIcons(root) {
  const icons = [
    ...(root || document).querySelectorAll(
      ".weather-icon[data-weather-lat][data-weather-lng]"
    ),
  ];

  if (!icons.length) {
    return;
  }

  if (
    "IntersectionObserver" in window &&
    !weatherIconObserver
  ) {
    weatherIconObserver =
      new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) {
              return;
            }

            weatherIconObserver.unobserve(
              entry.target
            );
            loadWeatherIcon(
              entry.target
            );
          });
        },
        {
          rootMargin: "160px",
        }
      );
  }

  icons.forEach((icon) => {
    if (weatherIconObserver) {
      weatherIconObserver.observe(
        icon
      );
      return;
    }

    loadWeatherIcon(icon);
  });
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

function renderFilterButtons() {
  if (!siteFilterContainer) return;

  const filters = isBikeMode()
    ? bikeSiteFilters
    : isPuebliarMode()
    ? puebliarSiteFilters
    : defaultSiteFilters;

  siteFilterContainer.innerHTML = filters
    .map(
      ([value, label], index) => `
        <button
          type="button"
          class="chip-filter site-filter ${index === 0 ? "active" : ""}"
          data-site-filter="${escapeHtml(value)}"
        >
          ${escapeHtml(label)}
        </button>
      `
    )
    .join("");
  siteFilterButtons = document.querySelectorAll(".site-filter");
}

function setupPageMode() {
  if (isPuebliarMode()) {
    document.title = "Puebliar | Parchar";

    if (sitePageTitle) {
      sitePageTitle.textContent =
        "Puebliar";
    }

    if (sitePageSubtitle) {
      sitePageSubtitle.textContent =
        "Pueblos, miradores y escapadas cercanas para salir de la ciudad.";
    }

    if (siteSearchInput) {
      siteSearchInput.placeholder =
        "Buscar pueblo, mirador o ruta";
    }

    if (siteLocationStatus) {
      siteLocationStatus.textContent =
        "Permite ubicacion para ordenar pueblos y rutas por cercania.";
    }
    return;
  }

  if (!isBikeMode()) {
    return;
  }

  document.title = "En bici | Parchar";

  if (sitePageTitle) {
    sitePageTitle.textContent = "En bici";
  }

  if (sitePageSubtitle) {
    sitePageSubtitle.textContent =
      "Ciclorutas, rutas urbanas, miradores y paradas utiles para pedalear cerca de ti.";
  }

  if (siteSearchInput) {
    siteSearchInput.placeholder =
      "Buscar cicloruta, ruta o parada";
  }

  if (siteLocationStatus) {
    siteLocationStatus.textContent =
      "Permite ubicacion para ordenar rutas en bici por cercania.";
  }
}

function setLocationStatus(message, isError = false) {
  if (!siteLocationStatus) return;
  siteLocationStatus.textContent = message;
  siteLocationStatus.classList.toggle("error", isError);
  siteLocationStatus.classList.toggle(
    "success",
    Boolean(message) && !isError
  );
}

function setActiveFilter(filter) {
  siteFilterButtons.forEach((button) => {
    const isActive = button.dataset.siteFilter === filter;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function matchesSite(site, query, filter) {
  const type = site.siteType || site.site_type || "";

  if (
    isBikeMode() &&
    !isBikeCandidate(site)
  ) {
    return false;
  }

  if (
    isPuebliarMode() &&
    !isPuebliarCandidate(site)
  ) {
    return false;
  }

  if (
    filter === "rutas_pueblo" &&
    type !== "ruta_pueblo" &&
    type !== "ruta_moto"
  ) {
    return false;
  }

  if (
    filter !== "todos" &&
    filter !== "rutas_pueblo" &&
    type !== filter
  ) {
    return false;
  }

  if (!query) {
    return true;
  }

  const haystack = normalizeText(
    [
      site.name,
      type,
      site.city,
      site.address,
      site.description,
      site.tags,
    ].join(" ")
  );

  return normalizeText(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

function isBikeCandidate(site) {
  const type =
    site.siteType || site.site_type || "";

  if (bikeSiteTypes.has(type)) {
    return true;
  }

  if (!bikeOptionalTypes.has(type)) {
    return false;
  }

  const haystack = normalizeText(
    [
      site.name,
      site.description,
      site.address,
      site.city,
      site.tags,
    ].join(" ")
  );

  return bikeKeywords.some((keyword) =>
    haystack.includes(keyword)
  );
}

function isPuebliarCandidate(site) {
  const type =
    site.siteType || site.site_type || "";

  if (puebliarSiteTypes.has(type)) {
    return true;
  }

  if (!puebliarOptionalTypes.has(type)) {
    return false;
  }

  const haystack = normalizeText(
    [
      site.name,
      site.description,
      site.address,
      site.city,
      site.tags,
    ].join(" ")
  );

  return puebliarKeywords.some((keyword) =>
    haystack.includes(keyword)
  );
}

function parseTags(tags) {
  return String(tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => {
      if (!tag) {
        return false;
      }

      return !internalPublicSiteTags.has(
        normalizeText(tag)
      );
    })
    .slice(0, 8);
}

function getPublicSiteDescription(site) {
  const description = String(
    site.description || ""
  )
    .replace(
      /\s*Pendiente por revisar:.*$/i,
      ""
    )
    .replace(
      /^(.+?) aparece como pueblo cercano para Puebliar\.?$/i,
      "Destino cercano para puebliar y hacer una escapada."
    )
    .trim();

  return (
    description ||
    "Destino cercano para puebliar. Revisa distancia y ruta antes de salir."
  );
}

function getPublicSiteAddress(site) {
  const address = String(
    site.address || ""
  ).trim();

  if (
    /^fuente:/i.test(address) ||
    /wikidata|wikipedia|base inicial parchar/i.test(
      address
    )
  ) {
    return "";
  }

  return address;
}

function renderSiteMedia(site) {
  if (!site.mediaPath) {
    return `
      <div class="site-media-placeholder">
        <span>${escapeHtml(siteTypeLabels[site.siteType] || "Sitio")}</span>
      </div>
    `;
  }

  return String(site.mediaType || "").startsWith("video/")
    ? `
      <video
        class="site-media"
        controls
        preload="metadata"
        playsinline
        src="${escapeHtml(site.mediaPath)}"
      ></video>
    `
    : `
      <img
        class="site-media"
        src="${escapeHtml(site.mediaPath)}"
        alt="${escapeHtml(site.name)}"
      />
    `;
}

function renderSiteCard(site) {
  const googleUrl = buildGoogleRouteUrl(site);
  const wazeUrl = buildWazeRouteUrl(site);
  const publicAddress = getPublicSiteAddress(site);
  const publicDescription =
    getPublicSiteDescription(site);
  const tags = parseTags(site.tags)
    .map((tag) => `<span>${escapeHtml(tag)}</span>`)
    .join("");
  const distanceKm = calculateDistanceKm(userCoords, site);

  return `
    <article class="place-card site-card">
      ${renderSiteMedia(site)}

      <header>
        <p class="chip">${escapeHtml(siteTypeLabels[site.siteType] || site.siteType)}</p>
        <h3>${escapeHtml(site.name)}</h3>
      </header>

      <p>
        <strong>Zona:</strong>
        ${escapeHtml(site.city)}
      </p>

      ${
        publicAddress
          ? `
            <p>
              <strong>Referencia:</strong>
              ${escapeHtml(publicAddress)}
            </p>
          `
          : ""
      }

      <p>${escapeHtml(publicDescription)}</p>

      ${tags ? `<div class="site-tags">${tags}</div>` : ""}

      <div class="distance-line site-route-line">
        <span>
          <strong>Distancia:</strong>
          ${escapeHtml(estimateTravelText(distanceKm))}
        </span>

        ${renderWeatherIcon(site)}

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
  const filteredSites = openSites
    .filter((site) =>
      matchesSite(site, query, activeFilter)
    )
    .map((site) => ({
      ...site,
      distanceKm: calculateDistanceKm(userCoords, site),
    }))
    .sort((a, b) => {
      if (
        a.distanceKm === null &&
        b.distanceKm === null
      ) {
        return String(a.name).localeCompare(String(b.name));
      }

      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });

  if (!filteredSites.length) {
    const title = isBikeMode()
      ? "Aun no hay rutas en bici cargadas."
      : isPuebliarMode()
      ? "Aun no hay pueblos o rutas cargadas."
      : "No encontramos sitios con ese filtro.";
    const message = isBikeMode()
      ? "Desde admin carga ciclorutas, rutas en bici, paradas ciclistas o sitios con etiqueta bici."
      : isPuebliarMode()
      ? "Desde admin carga pueblos, miradores o rutas a pueblos cercanos."
      : "Prueba con charco, mirador, pueblo, rio, cascada o naturaleza.";

    siteResultsEl.innerHTML = `
      <article class="empty-card">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
      </article>
    `;
    return;
  }

  siteResultsEl.innerHTML = filteredSites.map(renderSiteCard).join("");
  hydrateWeatherIcons(
    siteResultsEl
  );
}

async function loadSites() {
  if (!siteResultsEl) return;

  siteResultsEl.innerHTML = `
    <p class="loading">Cargando sitios...</p>
  `;

  try {
    const response = await fetch("/api/sites/active");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "No se pudieron cargar los sitios.");
    }

    openSites = (data.items || []).filter((site) =>
      isValidCoordinate(
        Number(site.latitude),
        Number(site.longitude)
      )
    );

    renderSites();
  } catch (error) {
    siteResultsEl.innerHTML = `
      <article class="empty-card">
        <h3>No pudimos cargar los sitios.</h3>
        <p>${escapeHtml(error.message)}</p>
      </article>
    `;
  }
}

function requestUserLocation() {
  if (!navigator.geolocation) {
    locationResolved = true;
    setLocationStatus(
      "Tu navegador no permite leer ubicacion. Se muestran sitios sin distancia.",
      true
    );
    renderSites();
    return;
  }

  setLocationStatus(
    isBikeMode()
      ? "Calculando rutas en bici cerca de ti..."
      : isPuebliarMode()
      ? "Calculando pueblos y rutas cerca de ti..."
      : "Calculando sitios cerca de ti..."
  );

  navigator.geolocation.getCurrentPosition(
    (position) => {
      userCoords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      locationResolved = true;
      setLocationStatus(
        isBikeMode()
          ? "Ubicacion lista. Rutas en bici ordenadas por cercania."
          : isPuebliarMode()
          ? "Ubicacion lista. Pueblos y rutas ordenados por cercania."
          : "Ubicacion lista. Sitios ordenados por cercania."
      );
      renderSites();
    },
    () => {
      locationResolved = true;
      userCoords = null;
      setLocationStatus(
        isBikeMode()
          ? "Permite ubicacion para ver distancia y tiempo en bici."
          : isPuebliarMode()
          ? "Permite ubicacion para ver distancia y ruta a pueblos cercanos."
          : "Permite ubicacion para ver distancia y tiempo desde donde estas.",
        true
      );
      renderSites();
    },
    {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 60000,
    }
  );
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

siteLocationButton?.addEventListener("click", () => {
  requestUserLocation();
});

setupPageMode();
renderFilterButtons();
setupSiteSearch();
setupSiteFilters();
loadSites().then(() => {
  if (!locationResolved) {
    requestUserLocation();
  }
});
