const tabs = [...document.querySelectorAll(".bike-tab")];
const typeSelect = document.querySelector("#bike-type");
const difficultySelect = document.querySelector("#bike-difficulty");
const radiusSelect = document.querySelector("#bike-radius");
const results = document.querySelector("#bike-results");
const statusEl = document.querySelector("#bike-status");
const locationEl = document.querySelector("#bike-location");
const dialog = document.querySelector("#bike-dialog");
const dialogTitle = document.querySelector("#bike-dialog-title");
const dialogMeta = document.querySelector("#bike-dialog-meta");
const stopsEl = document.querySelector("#bike-stops");
const navigationPanel = document.querySelector("#bike-navigation");
const navigationStatus = document.querySelector("#bike-navigation-status");
const navigationRemaining = document.querySelector("#bike-navigation-remaining");
const startNavigationButton = document.querySelector("#bike-start-navigation");
const reverseNavigationButton = document.querySelector("#bike-reverse-navigation");
const centerNavigationButton = document.querySelector("#bike-center-navigation");
const stopNavigationButton = document.querySelector("#bike-stop-navigation");
let kind = "cycleways";
let centre = null;
let routes = [];
let map = null;
let routeLayer = null;
let joinLine = null;
let joinMarker = null;
let requestNumber = 0;
let activeRoute = null;
let locationWatch = null;
let positionMarker = null;
let accuracyCircle = null;
let navigationDirection = 1;
let directionChosen = false;
let lastPosition = null;
let followingPosition = true;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function labelFor(category) {
  return { urban: "Urbana", road: "Carretera", mtb: "MTB", gravel: "Gravel" }[category] || category;
}

function render() {
  const type = typeSelect.value;
  const difficulty = difficultySelect.value;
  const visible = routes.filter((route) =>
    (!type || route.category === type) && (!difficulty || route.difficulty === difficulty)
  );
  if (!visible.length) {
    results.innerHTML = `<p class="bike-empty">${routes.length
      ? "Ninguna ruta coincide con estos filtros. Algunas fuentes no informan dificultad."
      : "No hay recorridos publicados para esta vista y zona."}
      ${!routes.length ? '<br><a href="/sites.html?mode=bike">Ver lugares para ciclistas en Parchar</a>' : ""}</p>`;
    return;
  }
  results.innerHTML = visible.map((route) => `
    <article class="bike-route">
      <div class="bike-route-head">
        <span class="bike-route-type">${escapeHtml(labelFor(route.category))}</span>
        <span>${escapeHtml(route.municipality || route.region || "Antioquia")}</span>
      </div>
      <h2>${escapeHtml(route.name)}</h2>
      <div class="bike-facts">
        <span>${Number(route.distance_km).toLocaleString("es-CO", { maximumFractionDigits: 1 })} km de ${kind === "cycleways" ? "tramo" : "recorrido"}</span>
        <span>A ${Number(route.nearby_km).toLocaleString("es-CO", { maximumFractionDigits: 1 })} km ${centre ? "de ti" : "del centro de Medellín"}</span>
        ${route.duration_min ? `<span>${escapeHtml(route.duration_min)} min</span>` : ""}
        ${route.elevation_gain_m != null ? `<span>+${escapeHtml(route.elevation_gain_m)} m</span>` : ""}
        ${route.surface ? `<span>${escapeHtml(route.surface)}</span>` : ""}
        ${route.updated_at ? `<span>Actualizada: ${new Date(route.updated_at).toLocaleDateString("es-CO")}</span>` : ""}
      </div>
      <div class="bike-route-foot">
        <small>${escapeHtml(route.attribution)}</small>
        <div>
          <button type="button" class="ghost-btn" data-stops="${escapeHtml(route.id)}">Paradas</button>
          <button type="button" class="primary-btn" data-route="${escapeHtml(route.id)}">Ver ruta</button>
        </div>
      </div>
    </article>`).join("");
}

async function loadRoutes() {
  const current = ++requestNumber;
  statusEl.textContent = "Consultando recorridos...";
  results.innerHTML = "";
  const url = new URL(`/api/bike/${kind}`, window.location.origin);
  url.searchParams.set("radius", radiusSelect.value);
  if (centre) {
    url.searchParams.set("lat", centre.lat);
    url.searchParams.set("lng", centre.lng);
  }
  try {
    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudieron cargar las rutas.");
    if (current !== requestNumber) return;
    routes = data.items || [];
    statusEl.textContent = kind === "cycleways"
      ? `${routes.length} tramo${routes.length === 1 ? "" : "s"} de ciclorruta oficial. No equivalen a una ruta completa.`
      : `${routes.length} recorrido${routes.length === 1 ? "" : "s"} disponible${routes.length === 1 ? "" : "s"}.`;
    render();
  } catch (error) {
    if (current !== requestNumber) return;
    routes = [];
    statusEl.textContent = error.message;
    render();
  }
}

function openMap(route) {
  if (map) {
    map.remove();
    map = null;
  }
  map = L.map("bike-map", { scrollWheelZoom: false });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  routeLayer = L.geoJSON(route.geometry, { style: { color: "#ffb947", weight: 5 } }).addTo(map);
  map.fitBounds(routeLayer.getBounds(), { padding: [18, 18], maxZoom: 15 });
  map.on("dragstart", () => { followingPosition = false; });
  setTimeout(() => map?.invalidateSize(), 50);
}

function setNavigationControls(active) {
  startNavigationButton.hidden = active;
  reverseNavigationButton.hidden = !active;
  centerNavigationButton.hidden = !active;
  stopNavigationButton.hidden = !active;
}

function stopNavigation(message = "Seguimiento detenido.") {
  if (locationWatch !== null) navigator.geolocation.clearWatch(locationWatch);
  locationWatch = null;
  if (positionMarker && map) map.removeLayer(positionMarker);
  if (accuracyCircle && map) map.removeLayer(accuracyCircle);
  if (joinLine && map) map.removeLayer(joinLine);
  if (joinMarker && map) map.removeLayer(joinMarker);
  positionMarker = null;
  accuracyCircle = null;
  joinLine = null;
  joinMarker = null;
  lastPosition = null;
  navigationRemaining.hidden = true;
  navigationStatus.textContent = message;
  setNavigationControls(false);
}

function updateNavigation(position) {
  if (locationWatch === null || !activeRoute || !map || !dialog.open) return;
  const point = { lat: position.coords.latitude, lng: position.coords.longitude };
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return;
  const accuracy = Number(position.coords.accuracy);
  lastPosition = position;
  if (!directionChosen) {
    navigationDirection = BikeNavigation.nearestEndDirection(activeRoute.geometry, point);
    directionChosen = true;
  }
  const progress = BikeNavigation.nearestOnRoute(activeRoute.geometry, point, navigationDirection);
  if (!progress) return;
  if (!positionMarker) {
    positionMarker = L.circleMarker([point.lat, point.lng], {
      radius: 8, color: "#fff", weight: 2, fillColor: "#008cff", fillOpacity: 1,
    }).addTo(map);
    accuracyCircle = L.circle([point.lat, point.lng], {
      radius: 1, color: "#008cff", weight: 1, fillOpacity: 0.08,
    }).addTo(map);
  } else {
    positionMarker.setLatLng([point.lat, point.lng]);
    accuracyCircle.setLatLng([point.lat, point.lng]);
  }
  accuracyCircle.setRadius(Number.isFinite(accuracy) ? Math.max(1, accuracy) : 1);
  const snapped = [progress.snapped.lat, progress.snapped.lng];
  if (!joinLine) {
    joinLine = L.polyline([[point.lat, point.lng], snapped], {
      color: "#49d9ff", weight: 3, dashArray: "6 7", opacity: 0.9,
    }).addTo(map);
    joinMarker = L.circleMarker(snapped, {
      radius: 7, color: "#fff", weight: 2, fillColor: "#49d9ff", fillOpacity: 1,
    }).addTo(map).bindTooltip("Punto de incorporación al trazado");
  } else {
    joinLine.setLatLngs([[point.lat, point.lng], snapped]);
    joinMarker.setLatLng(snapped);
  }
  if (followingPosition && routeLayer) {
    const bounds = routeLayer.getBounds().extend([point.lat, point.lng]);
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15, animate: false });
  }

  if (!Number.isFinite(accuracy) || accuracy > 100) {
    navigationRemaining.hidden = true;
    navigationStatus.textContent = "Señal GPS imprecisa. Espera una ubicación más precisa para continuar.";
    return;
  }
  navigationRemaining.hidden = false;
  navigationRemaining.textContent = `${Math.round(progress.remainingMeters)} m hasta el extremo del tramo`;
  if (progress.crossTrackMeters > Math.max(75, accuracy * 1.5)) {
    navigationStatus.textContent = `El punto celeste marca dónde unirte al trazado, a ${Math.round(progress.crossTrackMeters)} m en línea recta. Busca una vía segura para llegar; la línea punteada no es una calle.`;
  } else if (progress.remainingMeters <= 30 && accuracy <= 50) {
    navigationStatus.textContent = "Llegaste al extremo de este tramo.";
  } else {
    navigationStatus.textContent = `Siguiendo el trazado · precisión GPS ±${Math.round(accuracy)} m. Sin indicaciones giro a giro.`;
  }
}

function startNavigation() {
  if (!activeRoute || !navigator.geolocation || locationWatch !== null) {
    if (!navigator.geolocation) navigationStatus.textContent = "Este dispositivo no ofrece ubicación.";
    return;
  }
  navigationDirection = 1;
  directionChosen = false;
  followingPosition = true;
  navigationStatus.textContent = "Buscando señal GPS...";
  setNavigationControls(true);
  try {
    locationWatch = navigator.geolocation.watchPosition(updateNavigation, (error) => {
      const message = error.code === 1
        ? "No se concedió permiso de ubicación."
        : "No se pudo obtener una señal GPS. Intenta de nuevo.";
      stopNavigation(message);
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  } catch {
    stopNavigation("No se pudo iniciar el seguimiento en este dispositivo.");
  }
}

async function showDetail(id, showStops) {
  stopNavigation();
  activeRoute = null;
  dialogTitle.textContent = "Cargando recorrido...";
  dialogMeta.textContent = "";
  stopsEl.replaceChildren();
  navigationPanel.hidden = true;
  dialog.showModal();
  try {
    const response = await fetch(`/api/bike/route/${encodeURIComponent(id)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo abrir el recorrido.");
    const route = data.route;
    activeRoute = route;
    dialogTitle.textContent = route.name;
    dialogMeta.textContent = `${route.distance_km} km · ${route.attribution}`;
    openMap(route);
    navigationPanel.hidden = route.geometry?.type !== "LineString";
    if (navigationPanel.hidden) dialogMeta.textContent += " · Trazado no continuo: seguimiento no disponible.";
    else navigationStatus.textContent = "Guía sobre el trazado. No ofrece indicaciones giro a giro.";
    if (showStops) {
      stopsEl.innerHTML = "<h3>Paradas cercanas</h3><p>Buscando lugares...</p>";
      const stopsResponse = await fetch(`/api/bike/route/${encodeURIComponent(id)}/stops`);
      const stopsData = await stopsResponse.json();
      if (!stopsResponse.ok) throw new Error(stopsData.error || "No se pudieron consultar paradas.");
      stopsEl.innerHTML = `<h3>Paradas cercanas</h3>${stopsData.items.length
        ? `<ul>${stopsData.items.map((stop) => {
          const url = new URL(stop.kind === "site" ? "/sites.html" : "/places.html", window.location.origin);
          url.searchParams.set("q", stop.name);
          return `<li><a href="${escapeHtml(url.pathname + url.search)}">${escapeHtml(stop.name)}</a> · ${escapeHtml(stop.city || stop.category || "Antioquia")} · ${Math.round(stop.distance_from_route_km * 1000)} m del trazado</li>`;
        }).join("")}</ul>`
        : "<p>Aún no hay locales o sitios de Parchar junto a este recorrido.</p>"}`;
    }
  } catch (error) {
    dialogMeta.textContent = error.message;
    stopsEl.replaceChildren();
  }
}

tabs.forEach((button) => button.addEventListener("click", () => {
  kind = button.dataset.kind;
  tabs.forEach((tab) => {
    tab.classList.toggle("active", tab === button);
    if (tab === button) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  });
  loadRoutes();
}));
[typeSelect, difficultySelect].forEach((select) => select.addEventListener("change", render));
radiusSelect.addEventListener("change", loadRoutes);
document.querySelector("#bike-locate").addEventListener("click", () => {
  if (!navigator.geolocation) {
    locationEl.textContent = "Este dispositivo no ofrece ubicación.";
    return;
  }
  locationEl.textContent = "Buscando tu ubicación...";
  navigator.geolocation.getCurrentPosition(async (position) => {
    const point = { lat: position.coords.latitude, lng: position.coords.longitude };
    try {
      const url = new URL("/api/coverage/status", window.location.origin);
      url.searchParams.set("lat", point.lat);
      url.searchParams.set("lng", point.lng);
      const response = await fetch(url);
      const data = await response.json();
      if (response.ok && data.coverage?.enabled) {
        centre = point;
        locationEl.textContent = "Ordenando rutas cerca de ti.";
      } else {
        centre = null;
        locationEl.textContent = "Parchar inicia en Antioquia. Explorando rutas desde Medellín.";
      }
    } catch {
      centre = null;
      locationEl.textContent = "No se pudo validar la zona. Explorando rutas desde Medellín.";
    }
    loadRoutes();
  }, () => {
    locationEl.textContent = "No se obtuvo permiso. Sigues explorando desde Medellín.";
  }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
});
results.addEventListener("click", (event) => {
  const button = event.target.closest("[data-route], [data-stops]");
  if (button) showDetail(button.dataset.route || button.dataset.stops, Boolean(button.dataset.stops));
});
document.querySelector("#bike-close").addEventListener("click", () => dialog.close());
startNavigationButton.addEventListener("click", startNavigation);
reverseNavigationButton.addEventListener("click", () => {
  navigationDirection *= -1;
  directionChosen = true;
  if (lastPosition) updateNavigation(lastPosition);
});
centerNavigationButton.addEventListener("click", () => {
  followingPosition = true;
  if (lastPosition) updateNavigation(lastPosition);
});
stopNavigationButton.addEventListener("click", () => stopNavigation());
dialog.addEventListener("close", () => {
  stopNavigation();
  activeRoute = null;
  if (map) map.remove();
  map = null;
  routeLayer = null;
});
window.addEventListener("pagehide", () => stopNavigation());
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && locationWatch !== null) {
    navigationStatus.textContent = "Comprobando de nuevo tu ubicación GPS...";
  }
});
loadRoutes();
