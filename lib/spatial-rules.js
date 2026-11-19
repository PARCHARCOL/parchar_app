const TOPICS = [
  {
    id: "planes",
    name: "Planes locales",
    color: "#277e72",
    short: "Un plan empieza aquí",
  },
  {
    id: "arte",
    name: "Cine y arte",
    color: "#a04d65",
    short: "Miradas que se encuentran",
  },
  {
    id: "conversaciones",
    name: "Conversaciones",
    color: "#536ab0",
    short: "Preguntas para compartir",
  },
  {
    id: "reflexiones",
    name: "Reflexiones",
    color: "#8d6535",
    short: "Ideas para llevar contigo",
  },
];
const CITIES = [
  "Medellín",
  "Bello",
  "Itagüí",
  "Envigado",
  "Sabaneta",
  "La Estrella",
  "Caldas",
  "Copacabana",
  "Girardota",
  "Barbosa",
  "Otro municipio",
];
const LIFETIMES = { "2h": 7200000, "7d": 604800000, permanent: null };
function editionWindow(period, now = Date.now()) {
  if (!["morning", "night", "archive"].includes(period))
    throw new Error("Selecciona una edición válida.");
  const local = new Date(now - 18000000),
    hour = local.getUTCHours();
  const midnight = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
    5,
  );
  if (period === "archive")
    return {
      id: "archive",
      period,
      start: null,
      end: null,
      asOf: new Date(now).toISOString(),
    };
  const start =
    period === "morning"
      ? midnight + 21600000 - (hour < 6 ? 86400000 : 0)
      : midnight + 64800000 - (hour < 18 ? 86400000 : 0);
  return {
    id: `${new Date(start - 18000000).toISOString().slice(0, 10)}-${period}`,
    period,
    start: new Date(start).toISOString(),
    end: new Date(start + 43200000).toISOString(),
    asOf: new Date(now).toISOString(),
  };
}
function normalizeSpatial(body, now = Date.now()) {
  if (body.format !== "spatial-v1") return {};
  const title = String(body.title || "").trim(),
    kind = body.kind || "node";
  if (!title || title.length > 100 || !["node", "note"].includes(kind))
    throw new Error("Escribe un título válido de hasta 100 caracteres.");
  if (
    !TOPICS.some((t) => t.id === body.topic) ||
    !Number.isInteger(body.depth) ||
    body.depth < 0 ||
    body.depth > 100 ||
    !Object.hasOwn(LIFETIMES, body.lifetime)
  )
    throw new Error("Selecciona tema, profundidad y caducidad válidos.");
  if (body.city && !CITIES.includes(body.city))
    throw new Error("Selecciona un municipio válido.");
  const result = {
    format: "spatial-v1",
    kind,
    title,
    topic: body.topic,
    depth: body.depth,
    city: body.city || "",
    lifetime: body.lifetime,
    expiresAt:
      LIFETIMES[body.lifetime] === null
        ? null
        : new Date(now + LIFETIMES[body.lifetime]).toISOString(),
  };
  if (kind === "note") {
    if (
      !/^[a-f0-9-]{36}$/.test(body.parentId || "") ||
      !body.anchor ||
      ![body.anchor.x, body.anchor.y].every(
        (v) => Number.isFinite(v) && v >= 0 && v <= 1,
      ) ||
      typeof body.anchor.quote !== "string" ||
      body.anchor.quote.length > 200
    )
      throw new Error("Selecciona un punto válido para la nota.");
    if (
      body.anchor.start != null &&
      (!Number.isInteger(body.anchor.start) ||
        body.anchor.start < 0 ||
        body.anchor.start > 4000)
    )
      throw new Error("Selecciona un fragmento válido para la nota.");
    result.parentId = body.parentId;
    result.anchor = {
      x: body.anchor.x,
      y: body.anchor.y,
      quote: body.anchor.quote,
      ...(body.anchor.start == null ? {} : { start: body.anchor.start }),
    };
  }
  return result;
}
module.exports = { TOPICS, CITIES, LIFETIMES, editionWindow, normalizeSpatial };
