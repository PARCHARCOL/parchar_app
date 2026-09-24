const { createHash } = require("node:crypto");

const OFFICIAL_LAYERS = [
  "https://www.medellin.gov.co/servidormapas/rest/services/transporte/VM_Movilidad_Humana/MapServer/0",
  "https://www.medellin.gov.co/servidormapas/rest/services/transporte/VC_Infraest_Gestion_Transporte/MapServer/1",
];
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const MEDELLIN = { lat: 6.2442, lng: -75.5812 };
const cache = new Map();
const details = new Map();
let activeOsmRequests = 0;

function distanceKm(a, b) {
  const radians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * radians;
  const dLng = (b.lng - a.lng) * radians;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function lineParts(geometry) {
  if (geometry?.type === "LineString") return [geometry.coordinates];
  if (geometry?.type === "MultiLineString") return geometry.coordinates;
  return [];
}

function validGeometry(geometry) {
  const parts = lineParts(geometry).filter((part) =>
    Array.isArray(part) && part.length > 1 &&
    part.every((point) => Array.isArray(point) && point.length >= 2 &&
      Number.isFinite(point[0]) && Number.isFinite(point[1]) &&
      Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90)
  );
  if (!parts.length) return null;
  return parts.length === 1
    ? { type: "LineString", coordinates: parts[0] }
    : { type: "MultiLineString", coordinates: parts };
}

function geometryKm(geometry) {
  return lineParts(geometry).reduce((total, part) => {
    for (let i = 1; i < part.length; i += 1) {
      total += distanceKm(
        { lat: part[i - 1][1], lng: part[i - 1][0] },
        { lat: part[i][1], lng: part[i][0] }
      );
    }
    return total;
  }, 0);
}

function pointOf(geometry, last = false) {
  const parts = lineParts(geometry);
  const part = last ? parts[parts.length - 1] : parts[0];
  const point = last ? part[part.length - 1] : part[0];
  return { lat: point[1], lng: point[0], name: null };
}

function asDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function fetchJson(url, options = {}, timeoutMs = 12000) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "User-Agent": "Parchar/1.0 (bike routes)", ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(`Fuente externa: HTTP ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error("La fuente externa rechazó la consulta.");
  return data;
}

async function cached(key, ttlMs, loader) {
  const now = Date.now();
  const previous = cache.get(key);
  if (previous && previous.expires > now) return previous.value;
  if (previous?.pending) return previous.pending;
  if (cache.size >= 80 && !cache.has(key)) cache.delete(cache.keys().next().value);
  const pending = loader().then((value) => {
    cache.set(key, { value, expires: Date.now() + ttlMs });
    return value;
  }).catch((error) => {
    if (previous?.value) {
      cache.set(key, { ...previous, expires: Date.now() + 5 * 60_000 });
      return previous.value;
    }
    cache.delete(key);
    throw error;
  });
  cache.set(key, { value: previous?.value, expires: 0, pending });
  return pending;
}

function normaliseOfficial(feature, layer) {
  const p = feature.properties || {};
  const state = String(p.estado || "").toLowerCase();
  if ((layer === 0 && state !== "construida") ||
    (layer === 1 && state !== "existente")) return null;
  const geometry = validGeometry(feature.geometry);
  if (!geometry) return null;
  const id = p.objectid ?? feature.id;
  if (id === undefined || id === null) return null;
  const name = p.nombre_ciclorruta || p.corredor || p.nombre || p.label || "Tramo de red ciclista";
  const distance = geometryKm(geometry);
  return {
    id: `med:${layer}:${id}`,
    name: String(name),
    category: "urban",
    source: "medellin_arcgis",
    source_id: String(id),
    municipality: p.municipio || "Medellín",
    region: "Antioquia",
    start: pointOf(geometry),
    end: pointOf(geometry, true),
    distance_km: Number(distance.toFixed(2)),
    distance_source: "geometry-calculated",
    duration_min: null,
    elevation_gain_m: null,
    difficulty: null,
    surface: p.tipologia_redciclista || p.tipo || null,
    status: "existing",
    geometry,
    updated_at: asDate(p.fecha_actualizacion),
    attribution: "Alcaldía de Medellín",
  };
}

async function officialRoutes() {
  return cached("official-medellin", 7 * 24 * 60 * 60_000, async () => {
    const results = await Promise.allSettled(OFFICIAL_LAYERS.map(async (base, layer) => {
      const url = new URL(`${base}/query`);
      url.search = new URLSearchParams({
        where: layer === 1 ? "estado='Existente'" : "estado='Construida'",
        outFields: "*", f: "geojson", outSR: "4326",
        resultRecordCount: "2000", returnGeometry: "true",
      }).toString();
      const data = await fetchJson(url, {}, 16000);
      return (data.features || []).map((item) => normaliseOfficial(item, layer)).filter(Boolean);
    }));
    const routes = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    if (!routes.length && results.some((result) => result.status === "rejected")) {
      throw new Error("La red ciclista oficial no respondió. Intenta de nuevo más tarde.");
    }
    const geometries = new Set();
    return routes.filter((route) => {
      const hash = createHash("sha256").update(JSON.stringify(route.geometry.coordinates)).digest("hex");
      if (geometries.has(hash)) return false;
      geometries.add(hash);
      return true;
    });
  });
}

function normaliseOsm(element) {
  const segments = (element.members || []).filter((member) =>
    member.type === "way" && Array.isArray(member.geometry) && member.geometry.length > 1
  ).map((member) => member.geometry.map((point) => [point.lon, point.lat]));
  const geometry = validGeometry({ type: "MultiLineString", coordinates: segments });
  if (!geometry) return null;
  const tags = element.tags || {};
  const category = tags.route === "mtb" ? "mtb" : /gravel/i.test(tags.surface || "") ? "gravel" : "road";
  return {
    id: `osm:${element.id}`,
    name: tags.name || tags.ref || (category === "mtb" ? "Ruta MTB" : "Ruta ciclista"),
    category, source: "osm", source_id: String(element.id),
    municipality: null, region: "Antioquia",
    start: pointOf(geometry), end: pointOf(geometry, true),
    distance_km: Number(geometryKm(geometry).toFixed(2)),
    distance_source: "geometry-calculated",
    duration_min: null, elevation_gain_m: null, difficulty: null,
    surface: tags.surface || null, status: "existing", geometry,
    updated_at: null,
    attribution: "© OpenStreetMap contributors",
  };
}

async function osmRoutes(lat, lng, radiusKm) {
  const roundedLat = Math.round(lat * 10) / 10;
  const roundedLng = Math.round(lng * 10) / 10;
  const key = `osm:${roundedLat}:${roundedLng}:${radiusKm}`;
  return cached(key, 24 * 60 * 60_000, async () => {
    if (activeOsmRequests >= 2) throw new Error("Consulta OSM ocupada.");
    activeOsmRequests += 1;
    try {
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos(roundedLat * Math.PI / 180));
    const box = [roundedLat - latDelta, roundedLng - lngDelta,
      roundedLat + latDelta, roundedLng + lngDelta].map((n) => n.toFixed(5)).join(",");
    const query = `[out:json][timeout:20];(relation["type"="route"]["route"="bicycle"](${box});relation["type"="route"]["route"="mtb"](${box}););out tags geom;`;
    const data = await fetchJson(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: query }),
    }, 24000);
    return (data.elements || []).slice(0, 150).map(normaliseOsm).filter(Boolean);
    } finally {
      activeOsmRequests -= 1;
    }
  });
}

async function listRoutes(kind, lat, lng, radiusKm) {
  const centre = { lat, lng };
  const sources = kind === "cycleways"
    ? [distanceKm(centre, MEDELLIN) <= 40 ? officialRoutes() : Promise.resolve([])]
    : [osmRoutes(lat, lng, radiusKm)];
  const settled = await Promise.allSettled(sources);
  const routes = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  if (!routes.length && settled.every((result) => result.status === "rejected")) {
    throw new Error("No se pudieron consultar las rutas ahora.");
  }
  const filtered = routes.filter((route) => kind !== "mtb" || ["mtb", "gravel"].includes(route.category))
    .map((route) => ({ ...route, nearby_km: Number(nearLineKm(centre, route.geometry).toFixed(1)) }))
    .filter((route) => route.nearby_km <= radiusKm + 10)
    .sort((a, b) => a.nearby_km - b.nearby_km).slice(0, 100);
  filtered.forEach((route) => details.set(route.id, route));
  if (details.size > 500) {
    for (const key of [...details.keys()].slice(0, details.size - 500)) details.delete(key);
  }
  return filtered;
}

function routeById(id) {
  return details.get(id) || null;
}

function nearLineKm(point, geometry) {
  const scaleX = 111 * Math.cos(point.lat * Math.PI / 180);
  let nearest = Infinity;
  for (const line of lineParts(geometry)) {
    for (let i = 1; i < line.length; i += 1) {
      const a = line[i - 1], b = line[i];
      const ax = (a[0] - point.lng) * scaleX, ay = (a[1] - point.lat) * 111;
      const bx = (b[0] - point.lng) * scaleX, by = (b[1] - point.lat) * 111;
      const t = Math.max(0, Math.min(1, -(ax * (bx - ax) + ay * (by - ay)) /
        ((bx - ax) ** 2 + (by - ay) ** 2 || 1)));
      nearest = Math.min(nearest, Math.hypot(ax + t * (bx - ax), ay + t * (by - ay)));
    }
  }
  return nearest;
}

module.exports = { listRoutes, routeById, nearLineKm, distanceKm };
