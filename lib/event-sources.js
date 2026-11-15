const cheerio = require("cheerio");

const SOURCES = [
  { id: "mamm", name: "Museo de Arte Moderno de Medellín", url: "https://www.elmamm.org/programacion/", city: "Medellín", venue: "Museo de Arte Moderno de Medellín", address: "Carrera 44 # 19A-100" },
  { id: "pablo", name: "Teatro Pablo Tobón Uribe", url: "https://teatropablotobon.com/eventos/", city: "Medellín", venue: "Teatro Pablo Tobón Uribe", address: "Carrera 40 # 51-24" },
  { id: "metropolitano", name: "Teatro Metropolitano", url: "https://www.teatrometropolitano.com/programacion/eventos", city: "Medellín", venue: "Teatro Metropolitano José Gutiérrez Gómez", address: "Calle 41 # 57-30" },
  { id: "infolocal", name: "Infolocal · Comfenalco Antioquia", url: "https://infolocal.comfenalcoantioquia.com/index.php/agenda?show_past_events=0" },
  { id: "tiquetera", name: "La Tiquetera · Programación y Comfama", url: "https://latiquetera.com/" },
];
const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fold = (v) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const text = (v, max = 600) => String(v || "").replace(/\s+/g, " ").trim().slice(0, max);
function datesIn(textValue) {
  const dates = [];
  const pattern = /\b(\d{1,2})\s+(?:de\s+)?(ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|sep(?:tiembre)?|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?)\.?\s+(?:de\s+)?(20\d{2})\b/gi;
  for (const m of String(textValue).matchAll(pattern)) {
    const date = `${m[3]}-${String(months.indexOf(m[2].toLowerCase().slice(0, 3)) + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    if (!Number.isNaN(Date.parse(date)) && new Date(date).toISOString().startsWith(date)) dates.push(date);
  }
  return [...new Set(dates)];
}
function absolute(value, base) {
  if (typeof value !== "string" || !value.trim()) return "";
  try { const url = new URL(value, base); return url.protocol === "https:" && !url.username && !url.password ? url.href : ""; } catch { return ""; }
}
function readHtml(html) {
  const $ = cheerio.load(html);
  $("br").replaceWith(" ");
  return $;
}
function baseEvent(source, values, helpers) {
  const event = {
    city: source.city, venue: source.venue || "", address: source.address || "", time: "Horario por confirmar", endTime: "",
    price: "Consulta con el organizador", description: "Confirma la programación y las condiciones en la fuente del evento.", image: "",
    ...values, sourceKey: source.id, sourceName: source.name,
  };
  event.category = helpers.categoryFor(`${values.categoryText || ""} ${event.name}`);
  delete event.categoryText;
  if (!event.name || !helpers.validDate(event.date) || !helpers.validDate(event.endDate || event.date) || !helpers.CITIES.includes(event.city) || !absolute(event.sourceUrl, source.url)) return null;
  event.endDate ||= event.date;
  return event;
}
function parseMamm(html, source, helpers) {
  const $ = readHtml(html);
  return $(".card-eventos").map((_, card) => {
    const dateText = $(card).find(".date").text();
    const dates = datesIn(dateText);
    if (!dates.length) return null;
    return baseEvent(source, { name: text($(card).find("h3").text(), 160), date: dates[0], endDate: dates.at(-1),
      time: dates.length > 1 ? "Varias fechas: consulta horarios en la fuente" : "Horario por confirmar",
      sourceUrl: absolute($(card).find("a[href]").first().attr("href"), source.url), image: absolute($(card).find("img").first().attr("src"), source.url),
      price: text($(card).find(".ticket").text(), 120) || "Consulta con el organizador", categoryText: "arte" }, helpers);
  }).get().filter(Boolean);
}
function parsePablo(html, source, helpers) {
  const $ = readHtml(html);
  return $(".card").map((_, card) => {
    const date = datesIn($(card).find(".card__details").text())[0];
    if (!date) return null;
    const details = text($(card).find(".card__details").text());
    return baseEvent(source, { name: text($(card).find(".card__title").text(), 160), date, endDate: date,
      time: details.match(/\d{1,2}:\d{2}\s*[ap]\.m\./i)?.[0] || "Horario por confirmar",
      sourceUrl: absolute($(card).find('a[href*="/evento/"]').first().attr("href"), source.url),
      image: absolute($(card).find("img").first().attr("src"), source.url), categoryText: $(card).find(".chips__chip").first().text(),
      price: text($(card).find(".chips__chip").slice(1).text(), 120) || "Consulta con el organizador" }, helpers);
  }).get().filter(Boolean);
}
function parseMetropolitano(html, source, helpers) {
  const $ = readHtml(html);
  return $("article.event-card").map((_, card) => {
    const dateText = text($(card).find(".event-card__date").text());
    const dates = datesIn(dateText);
    if (!dates.length) return null;
    return baseEvent(source, { name: text($(card).find(".event-card__title").text(), 160), date: dates[0], endDate: dates.at(-1),
      time: dates.length > 1 ? `Varias funciones: ${dateText}` : dateText.match(/\b\d{2}:\d{2}\b/)?.[0] || "Horario por confirmar",
      sourceUrl: absolute($(card).find('a[href*="/programacion/eventos/"]').first().attr("href"), source.url),
      image: absolute($(card).find("img").first().attr("src"), source.url), categoryText: $(card).find(".event-card__tag").text() }, helpers);
  }).get().filter(Boolean);
}
function parseInfolocal(html, source, helpers) {
  const $ = readHtml(html);
  const events = [];
  $('[itemscope][itemtype$="/Event"]').each((_, root) => {
    const prop = (name) => { const e = $(root).find(`[itemprop="${name}"]`).first(); return text(e.attr("content") || e.attr("datetime") || e.text()); };
    const date = prop("startDate").slice(0, 10), endDate = prop("endDate").slice(0, 10) || date;
    const city = helpers.CITIES.find((c) => fold(c) === fold(prop("addressLocality")));
    const region = fold(prop("addressRegion"));
    const sourceUrl = absolute(prop("url"), source.url);
    if (!city || !date || (region && region !== "antioquia" && region !== "ant")) return;
    const cancelled = /EventCancelled$/.test(prop("eventStatus"));
    const event = baseEvent(source, { name: text(prop("name"), 160), date, endDate, city, sourceUrl,
      image: absolute(prop("image"), source.url), address: text(prop("address"), 200),
      venue: text($(root).find('[itemprop="organizer"] [itemprop="name"]').first().text(), 200),
      categoryText: text($(".categories-wrapper a").last().text()),
      time: date === endDate ? prop("doorTime") || "Horario por confirmar" : "Varias fechas: consulta cada función en la fuente",
      cancelled }, helpers);
    if (event) events.push(event);
  });
  return events;
}
function pageLinks(html, currentUrl, source, kind) {
  const $ = readHtml(html);
  const base = new URL(source.url);
  return [...new Set($("a[href]").map((_, e) => absolute($(e).attr("href"), currentUrl)).get())].filter((url) => {
    if (!url) return false;
    const u = new URL(url);
    if (u.hostname !== base.hostname || u.pathname !== base.pathname) return false;
    if (kind === "pablo") return /^\d+$/.test(u.searchParams.get("paged") || "");
    return /^\d+$/.test(u.searchParams.get("start") || "");
  }).map((url) => {
    const u = new URL(url); u.hash = "";
    if (kind === "infolocal") u.searchParams.set("show_past_events", "0");
    u.searchParams.sort(); return u.href;
  });
}
async function mapConcurrent(values, fn, concurrency = 4) {
  const results = new Array(values.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (next < values.length) { const index = next++; try { results[index] = await fn(values[index]); } catch { results[index] = null; } }
  }));
  return results;
}
async function collectPaged(source, helpers) {
  const queue = [source.url], visited = new Set(), records = [], details = new Set();
  while (queue.length) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    const html = await helpers.download(url);
    const $ = readHtml(html);
    if (source.id === "pablo") records.push(...parsePablo(html, source, helpers));
    else {
      $(".jitem-card").each((_, card) => {
        const city = text($(card).find('[itemprop="addressLocality"]').text());
        if (!helpers.CITIES.some((c) => fold(c) === fold(city))) return;
        const link = absolute($(card).find(".item-name[href]").attr("href"), source.url);
        if (link && new URL(link).hostname === new URL(source.url).hostname) details.add(link);
      });
    }
    for (const link of pageLinks(html, url, source, source.id)) if (!visited.has(link)) queue.push(link);
  }
  let failures = 0;
  if (source.id === "infolocal") {
    for (const result of await mapConcurrent([...details], async (url) => parseInfolocal(await helpers.download(url), source, helpers))) {
      if (result) records.push(...result); else failures++;
    }
  }
  if (!records.length) throw new Error("La fuente no entregó eventos legibles con fechas y municipio.");
  return { events: records, pages: visited.size, failures };
}
function parseTiqueteraCards(html, pageUrl, inheritedCity, helpers) {
  const $ = readHtml(html), entries = [];
  $(".item-box-event").each((_, card) => {
    const tags = $(card).find(".item-box-content .item-box-tags span").map((_, e) => text($(e).text()).split(",")[0]).get();
    const region = text($(card).find(".item-box-content .item-box-tags span").first().text()).split(",")[1];
    const city = tags.length === 1 && /^(ant|antioquia)$/i.test(text(region)) ? helpers.CITIES.find((c) => fold(c) === fold(tags[0])) : !tags.length ? inheritedCity : "";
    if (!city) return;
    const filters = $(card).attr("data-filters") || "";
    if (/category-(?:8|29)(?:,|$)/.test(filters)) return;
    const sourceUrl = absolute($(card).find("a[href]").first().attr("href"), pageUrl);
    if (!sourceUrl || new URL(sourceUrl).hostname !== "latiquetera.com") return;
    const dates = [...filters.matchAll(/date-(\d{4}-\d{2}-\d{2})/g)].map((m) => m[1]).filter(helpers.validDate);
    entries.push({ name: text($(card).find(".item-box-content-title").text(), 160), city, sourceUrl, dates,
      image: absolute($(card).find("img").first().attr("src"), pageUrl), categoryText: text($(card).find(".item-box-balloon-extra").text()) });
  });
  return entries;
}
async function collectTiquetera(source, helpers) {
  const queue = [{ url: source.url, city: "" }], visited = new Set(), entries = new Map();
  // Follow organizer schedules only within the public ticketing domain.
  while (queue.length) {
    const page = queue.shift();
    if (visited.has(page.url)) continue;
    visited.add(page.url);
    const html = await helpers.download(page.url);
    if (!readHtml(html)(".item-box-event").length) throw new Error("La programación no está disponible en esta consulta.");
    for (const entry of parseTiqueteraCards(html, page.url, page.city, helpers)) {
      if (!entry.dates.length && new URL(entry.sourceUrl).pathname.startsWith("/site/") && !new URL(entry.sourceUrl).pathname.includes("/events/")) {
        queue.push({ url: entry.sourceUrl, city: entry.city });
      } else if (entry.dates.some((d) => d >= helpers.today())) entries.set(entry.sourceUrl, entry);
    }
  }
  let failures = 0;
  const results = await mapConcurrent([...entries.values()], async (entry) => {
    const $ = readHtml(await helpers.download(entry.sourceUrl));
    const venue = text($(".event-tips-place").first().text(), 200);
    const time = text($(".event-tips-hour").first().text(), 100) || "Horario por confirmar";
    const soldOut = $(".event-date-sold-out").length > 0;
    return entry.dates.map((date) => baseEvent(source, { ...entry, date, endDate: date, venue, time,
      price: soldOut ? "La fuente indica entradas agotadas" : "Consulta precios y disponibilidad con el organizador" }, helpers)).filter(Boolean);
  });
  for (const result of results) if (!result) failures++;
  return { events: results.filter(Boolean).flat(), pages: visited.size, failures };
}
async function collectSource(source, helpers) {
  if (source.id === "pablo" || source.id === "infolocal") return collectPaged(source, helpers);
  if (source.id === "tiquetera") return collectTiquetera(source, helpers);
  const html = await helpers.download(source.url);
  const events = source.id === "mamm" ? parseMamm(html, source, helpers) : parseMetropolitano(html, source, helpers);
  if (!events.length) throw new Error("La fuente no entregó eventos legibles con fechas.");
  return { events, pages: 1, failures: 0 };
}
module.exports = { SOURCES, collectSource, datesIn, parseMamm, parsePablo, parseMetropolitano, parseInfolocal, parseTiqueteraCards, mapConcurrent };
