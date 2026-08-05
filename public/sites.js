const siteResultsEl = document.querySelector("#site-results");
const siteSearchForm = document.querySelector("#site-search-form");
const siteSearchInput = document.querySelector("#site-search");
const siteFilterButtons = document.querySelectorAll(".site-filter");
const siteLocationStatus = document.querySelector("#site-location-status");
const siteLocationButton = document.querySelector("#site-location-btn");

const siteTypeLabels = {
  charco: "Charco",
  mirador: "Mirador",
  pueblo: "Pueblo",
  naturaleza: "Naturaleza",
};

let openSites = [];
let userCoords = null;
let locationResolved = false;

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

  const driveMinutes = (km / 28) * 60;
  const parts = [
    `A ${formatDistance(km)} de ti`,
    `En carro aprox ${formatMinutes(driveMinutes)}`,
  ];

  if (km <= 3) {
    const walkMinutes = (km / 4.5) * 60;
    parts.push(
      `A pie aprox ${formatMinutes(walkMinutes)}`
    );
  }

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
  url.searchParams.set("travelmode", "driving");
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

  if (filter !== "todos" && type !== filter) {
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

function parseTags(tags) {
  return String(tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8);
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
        site.address
          ? `
            <p>
              <strong>Referencia:</strong>
              ${escapeHtml(site.address)}
            </p>
          `
          : ""
      }

      <p>${escapeHtml(site.description)}</p>

      ${tags ? `<div class="site-tags">${tags}</div>` : ""}

      <div class="distance-line site-route-line">
        <span>
          <strong>Distancia:</strong>
          ${escapeHtml(estimateTravelText(distanceKm))}
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

  setLocationStatus("Calculando sitios cerca de ti...");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      userCoords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      locationResolved = true;
      setLocationStatus(
        "Ubicacion lista. Sitios ordenados por cercania."
      );
      renderSites();
    },
    () => {
      locationResolved = true;
      userCoords = null;
      setLocationStatus(
        "Permite ubicacion para ver distancia y tiempo desde donde estas.",
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

setupSiteSearch();
setupSiteFilters();
loadSites().then(() => {
  if (!locationResolved) {
    requestUserLocation();
  }
});
