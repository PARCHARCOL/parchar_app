const cheerio = require("cheerio");
const { createHash } = require("node:crypto");
const { SOURCES: ADDITIONAL_SOURCES, collectSource, mapConcurrent } = require("./event-sources");

const CITIES = ["Medellín", "Bello", "Itagüí", "Envigado", "Sabaneta", "La Estrella", "Caldas", "Copacabana", "Girardota", "Barbosa"];
const CATEGORIES = { musica: "Música", teatro: "Teatro y humor", cine: "Cine", danza: "Danza", arte: "Arte y exposiciones", literatura: "Literatura", talleres: "Talleres", charlas: "Charlas", ferias: "Ferias", familia: "Familia", deporte: "Deporte", otros: "Otros planes" };
const SOURCE = { id: "patrimonio", name: "Agenda Colaborativa · Patrimonio Medellín", url: "https://agenda.patrimoniomedellin.gov.co/agenda-colaborativa/" };
const ALL_SOURCES = [...ADDITIONAL_SOURCES, SOURCE];
const months = "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split(" ");
const clean = (value, max = 300) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
const fold = (value) => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function today(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
function validDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}
function spanishDates(text) {
  return [...String(text).matchAll(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(\d{1,2}),?\s+(20\d{2})/gi)]
    .map((m) => `${m[3]}-${String(months.indexOf(m[1].toLowerCase()) + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`).filter(validDate);
}
function safeUrl(value) {
  try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password ? u.href : ""; } catch { return ""; }
}
function categoryFor(title) {
  const t = fold(title);
  if (/cine|cinema|pelicula/.test(t)) return "cine";
  if (/taller|laboratorio|curso/.test(t)) return "talleres";
  if (/charla|conversacion|conversatorio|tertulia/.test(t)) return "charlas";
  if (/teatro|humor|comedia|stand.up/.test(t)) return "teatro";
  if (/danza|ballet|baile|bailoteca|dancing|dance/.test(t)) return "danza";
  if (/concierto|musica|orquesta|vinilo|jazz|rock/.test(t)) return "musica";
  if (/exposicion|museo|arte|galeria/.test(t)) return "arte";
  if (/literatura|lectura|poesia|libro/.test(t)) return "literatura";
  if (/infantil|familia|ninos/.test(t)) return "familia";
  if (/feria|mercado/.test(t)) return "ferias";
  if (/carrera|deporte|ciclismo/.test(t)) return "deporte";
  return "otros";
}
function sourceEndTime(text) {
  const m = text.match(/[-–]\s*(\d{1,2}):(\d{2})\s*([ap])m/i);
  if (!m || Number(m[1]) > 12 || Number(m[2]) > 59) return "";
  return `${String(Number(m[1]) % 12 + (m[3].toLowerCase() === "p" ? 12 : 0)).padStart(2, "0")}:${m[2]}`;
}
function parseSourceListing(html) {
  const $ = cheerio.load(html);
  $("br").replaceWith(" ");
  const entries = new Map();
  $("a[href*='/pec-events/']").each((_, e) => {
    const url = safeUrl($(e).attr("href"));
    if (!url || new URL(url).hostname !== "agenda.patrimoniomedellin.gov.co") return;
    const image = safeUrl(($(e).attr("style") || "").match(/url\(['"]?([^'"()]+)['"]?\)/)?.[1]);
    entries.set(url, { url, image, venue: clean($(e).closest("li").find(".dp_pec_event_location").text(), 200) });
  });
  return [...entries.values()];
}
function parseSourceEvent(html, sourceUrl, listing = {}) {
  const $ = cheerio.load(html);
  $("br").replaceWith(" ");
  const name = clean($("h1").first().text(), 160);
  const dateLine = clean($(".pec_event_page_sub_p").first().text());
  const explicitDates = $(".pec_event_page_action_menu li").map((_, e) => spanishDates($(e).text())).get().flat();
  const dates = [...new Set(explicitDates.length ? explicitDates : spanishDates(dateLine).length === 1 ? spanishDates(dateLine) : [])];
  const timeMatch = dateLine.match(/\b\d{1,2}:\d{2}\s*[ap]m(?:\s*-\s*\d{1,2}:\d{2}\s*[ap]m)?/i);
  const venue = clean($(".pec_event_page_location, .dp_pec_event_location").first().text() || listing.venue, 200);
  if (!name) return [];
  return dates.map((date) => ({ name, date, endDate: date, city: "Medellín", category: categoryFor(name),
    time: timeMatch ? timeMatch[0] : /todo el d[ií]a/i.test(dateLine) ? "Todo el día" : "Horario por confirmar", endTime: sourceEndTime(dateLine),
    venue, address: "", price: "Consulta con el organizador", description: "Consulta la programación y las condiciones en la fuente del evento.",
    image: safeUrl(listing.image), sourceUrl: safeUrl(sourceUrl), sourceName: SOURCE.name }));
}
function parseSourceCalendar(html) {
  const $ = cheerio.load(html);
  $("br").replaceWith(" ");
  const events = new Map();
  $(".dp_pec_date[data-dppec-date]").each((_, cell) => {
    const date = $(cell).attr("data-dppec-date");
    if (!validDate(date)) return;
    $(cell).find(".eventsPreview li[data-dppec-event]").each((_, row) => {
      const sourceId = $(row).attr("data-dppec-event");
      const name = clean($(row).children("i").first().text(), 160);
      if (!/^\d+$/.test(sourceId || "") || !name) return;
      const daily = $(cell).find(".dp_daily_event").filter((_, e) => $(e).attr("data-dppec-event") === sourceId).first();
      const time = clean(daily.find("strong").text() || $(row).children("span").first().text(), 100) || "Horario por confirmar";
      const event = { name, date, endDate: date, city: "Medellín", category: categoryFor(name), time, endTime: sourceEndTime(time),
        venue: clean($(row).children("i").slice(1).text(), 200), address: "", price: "Consulta con el organizador",
        description: "Consulta la programación y las condiciones en la fuente del evento.", image: safeUrl($(row).find("img").first().attr("src")),
        sourceUrl: `https://agenda.patrimoniomedellin.gov.co/?p=${sourceId}`, sourceName: SOURCE.name };
      events.set(eventId(event), event);
    });
  });
  return [...events.values()];
}
function normalizeEvent(body) {
  const event = {
    name: clean(body.name, 160), date: clean(body.date, 10), endDate: clean(body.endDate || body.date, 10),
    city: CITIES.find((city) => fold(city) === fold(body.city)), category: body.category,
    time: clean(body.time || "Horario por confirmar", 100), venue: clean(body.venue, 200), address: clean(body.address, 200),
    endTime: clean(body.endTime, 5),
    price: clean(body.price || "Consulta con el organizador", 120), description: clean(body.description, 600),
    sourceUrl: safeUrl(body.sourceUrl), sourceName: clean(body.sourceName || "Organizador", 120), image: safeUrl(body.image),
    audience: body.audience === "restringido" ? "restringido" : "publico",
    organizerType: body.organizerType === "privado" ? "privado" : "institucional",
    referenceChecked: body.referenceChecked === true || body.referenceChecked === "on",
    imageRightsConfirmed: body.imageRightsConfirmed === true || body.imageRightsConfirmed === "on",
    imageAuthorization: clean(body.imageAuthorization, 300),
  };
  if (!event.name || !event.city || !Object.hasOwn(CATEGORIES, event.category) || !validDate(event.date) || !validDate(event.endDate) || event.endDate < event.date || !event.sourceUrl || (event.endTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.endTime))) {
    throw new Error("Revisa nombre, municipio, categoría, fechas y enlace HTTPS de la fuente.");
  }
  return event;
}
function eventMatches(event, { date, until = date, city, category, q = "" }) {
  return event.date <= until && event.endDate >= date && (!city || event.city === city) && (!category || event.category === category) &&
    (!q || fold(`${event.name} ${event.venue} ${event.description}`).includes(fold(q)));
}
function eventId(event) {
  return createHash("sha256").update(`${fold(event.name)}|${event.date}|${fold(event.city)}`).digest("hex").slice(0, 32);
}
function duplicateKey(event) {
  let name = fold(event.name).replace(/[^a-z0-9]+/g, " ").trim();
  const city = fold(event.city).replace(/[^a-z0-9]+/g, " ").trim();
  for (let i = 0; i < 2; i++) name = name.replace(new RegExp(` (?:en vivo|${city})$`), "");
  return `${name}|${event.date}|${city}`;
}
async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { "User-Agent": "ParcharAgenda/1.0" } });
  if (!response.ok) throw new Error(`La fuente respondió ${response.status}.`);
  return response.text();
}
function createAgenda({ pool, sendJson, parseJsonBody }) {
  let syncing = null;
  let initialSyncPending = true;
  let timer;
  let lastSync = { updatedAt: null, message: "Sincronización inicial pendiente." };
  async function init() {
    await pool.query("CREATE TABLE IF NOT EXISTS agenda_events (id TEXT PRIMARY KEY, payload TEXT NOT NULL, status TEXT NOT NULL, locked INTEGER NOT NULL DEFAULT 0, source_kind TEXT NOT NULL, updated_at TEXT NOT NULL)");
    const saved = await pool.query("SELECT payload FROM agenda_events WHERE id = $1", ["__sync__"]);
    if (saved.rows[0]) lastSync = JSON.parse(saved.rows[0].payload);
    timer = setTimeout(() => { initialSyncPending = false; sync().catch(console.error); }, 3000);
    timer.unref();
    const interval = setInterval(() => sync().catch(console.error), 6 * 60 * 60 * 1000);
    interval.unref();
  }
  async function records() {
    const result = await pool.query("SELECT * FROM agenda_events WHERE id <> $1", ["__sync__"]);
    return result.rows.map((r) => ({ ...JSON.parse(r.payload), id: r.id, status: r.status, locked: Boolean(r.locked), sourceKind: r.source_kind, updatedAt: r.updated_at }));
  }
  async function sync() {
    if (syncing) return syncing;
    syncing = (async () => {
      const helpers = { download, categoryFor, validDate, CITIES, today };
      const results = await mapConcurrent(ALL_SOURCES, async (source) => {
        try {
          let result;
          if (source.id === SOURCE.id) {
            const html = await download(SOURCE.url);
            const found = new Map(parseSourceCalendar(html).map((event) => [eventId(event), event]));
            const detailed = await mapConcurrent(parseSourceListing(html), async (listing) => parseSourceEvent(await download(listing.url), listing.url, listing));
            for (const events of detailed) for (const event of events || []) found.set(eventId(event), event);
            if (!found.size) throw new Error("La fuente no entregó eventos legibles.");
            result = { events: [...found.values()], failures: detailed.filter((e) => !e).length };
          } else result = await collectSource(source, helpers);
          return { source, ...result, ok: true };
        } catch { return { source, ok: false, events: [], message: "No disponible en esta consulta. Se conserva la última información." }; }
      }, 3);
      const found = new Map();
      const duplicates = new Map();
      const duplicateIds = new Set();
      const statuses = [];
      for (const result of results.filter(Boolean)) {
        const events = [...new Map(result.events.filter((e) => e.endDate >= today()).map((e) => [eventId(e), e])).values()];
        statuses.push({ id: result.source.id, name: result.source.name, url: result.source.url, ok: result.ok, count: events.length,
          message: result.message || (result.failures ? `${result.failures} referencias no se pudieron consultar.` : "Consulta completada."), checkedAt: new Date().toISOString() });
        for (const event of events) {
          event.sourceKey ||= result.source.id;
          event.audience = "publico";
          event.verificationScope = "referencia_publicada";
          const id = eventId(event), key = duplicateKey(event), previousId = duplicates.get(key), previous = found.get(previousId || id);
          if (!previous) { found.set(id, event); duplicates.set(key, id); }
          else {
            if (previousId && previousId !== id) duplicateIds.add(id);
            if (event.cancelled) previous.cancelled = true;
            previous.venue ||= event.venue;
            previous.address ||= event.address;
            previous.image ||= event.image;
            previous.references ||= [{ name: previous.sourceName, url: previous.sourceUrl }];
            if (!previous.references.some((r) => r.url === event.sourceUrl)) previous.references.push({ name: event.sourceName, url: event.sourceUrl });
          }
        }
      }
      const updatedAt = new Date().toISOString();
      const values = [...found.entries()];
      for (let offset = 0; offset < values.length; offset += 100) {
        const batch = values.slice(offset, offset + 100), params = [];
        const placeholders = batch.map(([id, event], i) => {
          params.push(id, JSON.stringify(event), event.cancelled ? "pausado" : "activo", 0, "automatico", updatedAt);
          return `(${Array.from({ length: 6 }, (_, j) => `$${i * 6 + j + 1}`).join(",")})`;
        });
        await pool.query(`INSERT INTO agenda_events (id,payload,status,locked,source_kind,updated_at) VALUES ${placeholders.join(",")} ON CONFLICT (id) DO UPDATE SET payload=excluded.payload,status=excluded.status,updated_at=excluded.updated_at WHERE agenda_events.locked=0`, params);
      }
      for (const id of duplicateIds) await pool.query("UPDATE agenda_events SET status=$1 WHERE id=$2 AND locked=0", ["pausado", id]);
      const successful = statuses.filter((s) => s.ok).length;
      lastSync = { ...lastSync, ...(successful ? { updatedAt, errorAt: null } : { errorAt: updatedAt }),
        message: `${found.size} fechas consultadas en ${successful} fuentes.${successful < ALL_SOURCES.length ? ` ${ALL_SOURCES.length - successful} fuentes no disponibles.` : ""}`,
        sources: statuses, source: undefined };
      await pool.query("INSERT INTO agenda_events (id,payload,status,locked,source_kind,updated_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at",
        ["__sync__", JSON.stringify(lastSync), "interno", 1, "sistema", new Date().toISOString()]);
      return lastSync;
    })().finally(() => { syncing = null; });
    return syncing;
  }
  async function handle(req, res, url, staffAuth) {
    const admin = url.pathname.startsWith("/api/admin/events");
    if (!admin && url.pathname !== "/api/events") return false;
    if (req.method === "GET") {
      const date = url.searchParams.get("date") || today();
      const until = url.searchParams.get("until") || date;
      const city = url.searchParams.get("city") || "";
      if (!validDate(date) || !validDate(until) || until < date || (city && !CITIES.includes(city))) { sendJson(res, 400, { error: "Fecha o municipio inválido." }); return true; }
      let items = await records();
      if (!admin) items = items.filter((event) => event.status === "activo" && event.audience !== "restringido" && (event.organizerType !== "privado" || event.referenceChecked) && event.endDate >= today() &&
        (!event.endTime || Date.now() <= Date.parse(`${event.endDate}T${event.endTime}:00-05:00`)) &&
        (event.sourceKind !== "automatico" || Date.now() - Date.parse(event.updatedAt) < 72 * 3600000) &&
        eventMatches(event, { date, until, city, category: url.searchParams.get("category"), q: url.searchParams.get("q") }));
      items.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.name.localeCompare(b.name));
      if (!admin) items = items.map(({ checkedBy, checkedAt, referenceChecked, locked, imageRightsConfirmed, imageAuthorization, ...event }) => ({ ...event, image: imageRightsConfirmed && imageAuthorization ? event.image : "" }));
      sendJson(res, 200, { items, cities: CITIES, categories: CATEGORIES, today: today(), sync: { ...lastSync, running: initialSyncPending || Boolean(syncing) } });
      return true;
    }
    if (admin && req.method === "POST") {
      if (url.pathname === "/api/admin/events/sync") { sendJson(res, 200, { ok: true, sync: await sync() }); return true; }
      const body = await parseJsonBody(req);
      if (url.pathname === "/api/admin/events/status") {
        const result = await pool.query("SELECT id,payload FROM agenda_events WHERE id=$1 AND id<>$2", [clean(body.id), "__sync__"]);
        if (!result.rows.length) { sendJson(res, 404, { error: "Evento no encontrado." }); return true; }
        const event = JSON.parse(result.rows[0].payload);
        if (body.status === "activo" && event.organizerType === "privado" && !event.referenceChecked) { sendJson(res, 400, { error: "Revisa y confirma la referencia del organizador privado antes de publicar." }); return true; }
        await pool.query("UPDATE agenda_events SET status=$1,locked=1,source_kind=$2,updated_at=$3 WHERE id=$4", [body.status === "activo" ? "activo" : "pausado", "manual", new Date().toISOString(), body.id]);
        sendJson(res, 200, { ok: true }); return true;
      }
      if (url.pathname === "/api/admin/events") {
        try {
          const event = normalizeEvent(body);
          if (body.status === "activo" && event.organizerType === "privado" && !event.referenceChecked) throw new Error("Confirma la referencia del organizador privado antes de publicar.");
          if (event.imageRightsConfirmed && !event.imageAuthorization) throw new Error("Registra la licencia o autorización que permite mostrar la imagen en Parchar.");
          if (event.referenceChecked) { event.checkedBy = staffAuth?.staff?.username || "equipo"; event.checkedAt = new Date().toISOString(); event.verificationScope = "referencia_revisada"; }
          const id = body.id ? clean(body.id) : eventId(event);
          if (id === "__sync__") throw new Error("Identificador inválido.");
          await pool.query("INSERT INTO agenda_events (id,payload,status,locked,source_kind,updated_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET payload=excluded.payload,status=excluded.status,locked=1,source_kind=excluded.source_kind,updated_at=excluded.updated_at",
            [id, JSON.stringify(event), body.status === "activo" ? "activo" : "pausado", 1, "manual", new Date().toISOString()]);
          sendJson(res, 200, { ok: true, id });
        } catch (error) { sendJson(res, 400, { error: error.message }); }
        return true;
      }
    }
    sendJson(res, 405, { error: "Acción no disponible." });
    return true;
  }
  return { init, handle, sync };
}
module.exports = { createAgenda, today, validDate, spanishDates, parseSourceListing, parseSourceEvent, parseSourceCalendar, normalizeEvent, eventMatches, eventId, duplicateKey, categoryFor, CITIES, CATEGORIES };
