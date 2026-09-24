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
const navigationEl = document.querySelector("#bike-navigation");
const navigationStatus = document.querySelector("#bike-navigation-status");
const navigationStep = document.querySelector("#bike-navigation-step");
const navigationRemaining = document.querySelector("#bike-navigation-remaining");
const startNavigationButton = document.querySelector("#bike-start-navigation");
const centerNavigationButton = document.querySelector("#bike-center-navigation");
const fitRouteButton = document.querySelector("#bike-fit-route");
const stopNavigationButton = document.querySelector("#bike-stop-navigation");
let kind = "cycleways";
let centre = null;
let routes = [];
let map = null;
let requestNumber = 0;
let activeRoute = null;
let routeLayer = null;
let streetRouteLayer = null;
let riderMarker = null;
let riderAccuracy = null;
let geolocationWatch = null;
let cyclingSteps = [];
let cyclingDistance = 0;
let selectedDirection = 1;
let routeEntryProgressMeters = 0;
let lastRouteRequestAt = 0;

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
  activeRoute = route;
  routeLayer = L.geoJSON(route.geometry, { style: { color: "#ffb947", weight: 6, opacity: 1 } }).addTo(map);
  streetRouteLayer = null;
  riderMarker = null;
  riderAccuracy = null;
  map.fitBounds(routeLayer.getBounds(), { padding: [18, 18], maxZoom: 15 });
  setTimeout(() => map?.invalidateSize(), 50);
}

function formatDistance(meters) {
  return meters >= 1000
    ? `${(meters / 1000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} km`
    : `${Math.max(0, Math.round(meters / 10) * 10)} m`;
}

function setNavigationMessage(message, step = "", remaining = "") {
  navigationStatus.textContent = message;
  navigationStep.textContent = step;
  navigationStep.hidden = !step;
  navigationRemaining.textContent = remaining;
  navigationRemaining.hidden = !remaining;
}

function stopNavigation(message = "Guía detenida. El recorrido publicado se mantiene en dorado.") {
  if (geolocationWatch != null) navigator.geolocation?.clearWatch(geolocationWatch);
  geolocationWatch = null;
  cyclingSteps = [];
  cyclingDistance = 0;
  routeEntryProgressMeters = 0;
  streetRouteLayer?.remove();
  streetRouteLayer = null;
  riderMarker?.remove();
  riderMarker = null;
  riderAccuracy?.remove();
  riderAccuracy = null;
  startNavigationButton.hidden = false;
  centerNavigationButton.hidden = true;
  stopNavigationButton.hidden = true;
  setNavigationMessage(message);
}

function updateRider(position) {
  if (!map) return;
  const point = [position.coords.latitude, position.coords.longitude];
  const accuracy = Math.max(5, Number(position.coords.accuracy) || 20);
  if (!riderMarker) {
    riderMarker = L.marker(point, {
      title: "Tu ubicación en la ruta",
      icon: L.divIcon({
        className: "bike-rider-brand-marker",
        html: '<img src="/assets/icons/icon-512.png" alt="" />',
        iconSize: [56, 56],
        iconAnchor: [28, 28],
      }),
    }).addTo(map).bindTooltip("Tu ubicación · Parchar", { direction: "top", offset: [0, -25] });
    riderAccuracy = L.circle(point, {
      radius: accuracy, color: "#1677ff", weight: 1, fillColor: "#1677ff", fillOpacity: .12,
    }).addTo(map);
  } else {
    riderMarker.setLatLng(point);
    riderAccuracy.setLatLng(point).setRadius(accuracy);
  }
  const location = { lat: point[0], lng: point[1] };
  if (!streetRouteLayer) return;
  const progress = BikeNavigation.nearestOnRoute(streetRouteLayer.toGeoJSON().geometry, location);
  if (!progress) {
    setNavigationMessage("No se puede seguir la ruta calculada porque sus coordenadas no son continuas.");
  } else if (progress.crossTrackMeters > Math.max(60, accuracy * 1.5)) {
    setNavigationMessage("Estás fuera de la ruta calculada.", "Vuelve a la línea azul por una vía segura; no se trazan atajos.", `${formatDistance(progress.crossTrackMeters)} de la ruta · ${formatDistance(progress.remainingMeters)} pendientes`);
  } else {
    const reachedPublishedRoute = progress.progressMeters >= routeEntryProgressMeters - Math.max(35, accuracy);
    const nextManeuver = BikeNavigation.nextManeuverAtDistance(cyclingSteps, progress.progressMeters);
    const nextInstruction = nextManeuver
      ? `${nextManeuver.instruction} en ${formatDistance(nextManeuver.distanceMeters)}`
      : "";
    setNavigationMessage(
      reachedPublishedRoute ? "Ya estás en el recorrido publicado" : "Siguiendo calles ciclables hacia el recorrido",
      BikeNavigation.instructionAtDistance(cyclingSteps, progress.progressMeters),
      [nextInstruction, reachedPublishedRoute
        ? `${formatDistance(progress.remainingMeters)} para terminar el recorrido`
        : `${formatDistance(Math.max(0, routeEntryProgressMeters - progress.progressMeters))} hasta la entrada · ${formatDistance(progress.remainingMeters)} en total`]
        .filter(Boolean).join(" · "),
    );
  }
}

async function calculateCyclingRoute(position) {
  if (!activeRoute || !map) return;
  const origin = { lat: position.coords.latitude, lng: position.coords.longitude };
  selectedDirection = BikeNavigation.nearestEndDirection(activeRoute.geometry, origin);
  const points = activeRoute.geometry.coordinates;
  const publishedWaypoints = BikeNavigation.routeWaypoints(activeRoute.geometry, selectedDirection);
  if (!publishedWaypoints?.length) {
    setNavigationMessage("El trazado publicado no se puede convertir en una ruta ciclable continua.");
    return;
  }
  const destinationCoordinate = selectedDirection === 1 ? points[0] : points[points.length - 1];
  const destination = { lat: Number(destinationCoordinate[1]), lng: Number(destinationCoordinate[0]) };
  const via = publishedWaypoints.slice(1, -1);
  const url = BikeNavigation.buildCyclingRouteUrl(origin, publishedWaypoints.length > 1
    ? { lat: publishedWaypoints[publishedWaypoints.length - 1].lat, lng: publishedWaypoints[publishedWaypoints.length - 1].lng }
    : destination, via);
  if (!url) {
    setNavigationMessage("No se pudo preparar una ruta ciclable con estas coordenadas.");
    return;
  }
  const wait = Math.max(0, 1100 - (Date.now() - lastRouteRequestAt));
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRouteRequestAt = Date.now();
  setNavigationMessage("Calculando por calles ciclables la llegada y el recorrido completo...");
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    const data = await response.json();
    const cyclingRoute = data.code === "Ok" ? data.routes?.[0] : null;
    if (!response.ok || !cyclingRoute?.geometry?.coordinates?.length) {
      throw new Error(data.message || "El enrutador no encontró calles ciclables hasta el recorrido.");
    }
    streetRouteLayer?.remove();
    streetRouteLayer = L.geoJSON(cyclingRoute.geometry, {
      style: { color: "#1687ff", weight: 6, opacity: .95, dashArray: "10 7" },
    }).addTo(map);
    cyclingSteps = (cyclingRoute.legs || []).flatMap((leg) => leg.steps || []);
    cyclingDistance = Number(cyclingRoute.distance) || 0;
    const entryProgress = BikeNavigation.nearestOnRoute(cyclingRoute.geometry, destination);
    routeEntryProgressMeters = entryProgress?.alongMeters || 0;
    startNavigationButton.hidden = true;
    centerNavigationButton.hidden = false;
    stopNavigationButton.hidden = false;
    const bounds = L.featureGroup([routeLayer, streetRouteLayer]).getBounds();
    if (riderMarker) bounds.extend(riderMarker.getLatLng());
    map.fitBounds(bounds, { padding: [22, 22], maxZoom: 16 });
    setNavigationMessage(
      `Recorrido completo calculado por calles ciclables · ${formatDistance(cyclingDistance)}`,
      BikeNavigation.instructionAtDistance(cyclingSteps, 0),
      [BikeNavigation.nextManeuverAtDistance(cyclingSteps, 0), `${formatDistance(routeEntryProgressMeters)} hasta el inicio · ${formatDistance(cyclingDistance)} en total`]
        .map((item) => typeof item === "string" ? item : item && `${item.instruction} en ${formatDistance(item.distanceMeters)}`)
        .filter(Boolean).join(" · "),
    );
  } catch (error) {
    routeEntryProgressMeters = 0;
    startNavigationButton.hidden = false;
    stopNavigationButton.hidden = true;
    setNavigationMessage(error.message || "No se pudo calcular la llegada en bici.");
  }
}

function beginNavigation() {
  if (!activeRoute || !map || !BikeNavigation.isRoutableGeometry(activeRoute.geometry)) {
    setNavigationMessage("Este recorrido no tiene un trazado continuo para activar la guía.");
    return;
  }
  if (!navigator.geolocation) {
    setNavigationMessage("Este dispositivo no ofrece ubicación GPS.");
    return;
  }
  startNavigationButton.disabled = true;
  setNavigationMessage("Solicitando ubicación GPS...");
  navigator.geolocation.getCurrentPosition(async (position) => {
    updateRider(position);
    await calculateCyclingRoute(position);
    startNavigationButton.disabled = false;
    if (streetRouteLayer && geolocationWatch == null) {
      geolocationWatch = navigator.geolocation.watchPosition(updateRider, () => {
        setNavigationMessage("Se perdió la señal GPS. Comprueba el permiso de ubicación.");
      }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 });
    }
  }, (error) => {
    startNavigationButton.disabled = false;
    const message = error.code === 1
      ? "Permite el acceso a tu ubicación para calcular la llegada en bici."
      : "No se pudo obtener tu ubicación GPS. Inténtalo de nuevo al aire libre.";
    setNavigationMessage(message);
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 });
}

async function showDetail(id, showStops) {
  dialogTitle.textContent = "Cargando recorrido...";
  dialogMeta.textContent = "";
  stopsEl.replaceChildren();
  dialog.showModal();
  try {
    const response = await fetch(`/api/bike/route/${encodeURIComponent(id)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo abrir el recorrido.");
    const route = data.route;
    stopNavigation("Ruta original publicada en dorado. Activa la guía para calcular la llegada en bici.");
    dialogTitle.textContent = route.name;
    dialogMeta.textContent = `${route.distance_km} km · ${route.attribution}`;
    openMap(route);
    navigationEl.hidden = !BikeNavigation.isRoutableGeometry(route.geometry);
    setNavigationMessage(navigationEl.hidden
      ? "Este recorrido no tiene una línea continua para guiar."
      : "El recorrido original se conserva en dorado; la llegada por calles se calcula al activar la guía.");
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
startNavigationButton.addEventListener("click", beginNavigation);
centerNavigationButton.addEventListener("click", () => {
  if (map && riderMarker) map.panTo(riderMarker.getLatLng());
});
fitRouteButton.addEventListener("click", () => {
  if (map && routeLayer) map.fitBounds(routeLayer.getBounds(), { padding: [18, 18], maxZoom: 15 });
});
stopNavigationButton.addEventListener("click", () => stopNavigation());
dialog.addEventListener("close", () => {
  stopNavigation("Guía detenida. El recorrido publicado se mantiene en dorado.");
  if (map) map.remove();
  map = null;
  activeRoute = null;
  routeLayer = null;
  streetRouteLayer = null;
});
loadRoutes();
