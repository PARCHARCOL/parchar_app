const test = require("node:test");
const assert = require("node:assert/strict");
const agenda = require("../lib/event-agenda");
const sources = require("../lib/event-sources");
const helpers = { ...agenda };

test("reads Spanish full and abbreviated dates without relying on publication dates", () => {
  assert.deepEqual(sources.datesIn("Jueves 19 de noviembre de 2026 y vie. 20 nov. 2026"), ["2026-11-19", "2026-11-20"]);
  assert.deepEqual(sources.datesIn("31 de febrero 2026"), []);
});
test("MAMM uses the event dates and classifies concerts as music", () => {
  const html = '<div class="card-eventos"><h3>Concierto de prueba</h3><p class="date">17 de noviembre 2026</p><p class="ticket">Entrada libre</p><a href="/producto/prueba/">Más</a></div>';
  const [event] = sources.parseMamm(html, sources.SOURCES[0], helpers);
  assert.equal(event.date, "2026-11-17");
  assert.equal(event.category, "musica");
  assert.equal(event.city, "Medellín");
});
test("Comfenalco uses the event municipality, not its publisher's city", () => {
  const html = '<article itemscope itemtype="https://schema.org/Event"><h1 itemprop="name">Cine de prueba</h1><p itemprop="startDate">2026-11-24</p><p itemprop="endDate">2026-11-24</p><p itemprop="url">https://example.org/evento</p><span itemprop="addressLocality">Envigado</span><span itemprop="addressRegion">Antioquia</span><span itemprop="doorTime">05:45 PM</span></article>';
  const source = sources.SOURCES.find((s) => s.id === "infolocal");
  const [event] = sources.parseInfolocal(html, source, helpers);
  assert.equal(event.city, "Envigado");
  assert.equal(event.category, "cine");
  assert.equal(sources.parseInfolocal(html.replace("Envigado", "Barbosa").replace("Antioquia", "Santander"), source, helpers).length, 0);
});
test("ticket discovery excludes other regions, subscriptions and out-of-area travel products", () => {
  const card = (city, region, type) => `<div class="item-box-event" data-filters="category-${type},date-2026-11-20"><div class="item-box-content"><h3 class="item-box-content-title">Prueba</h3><div class="item-box-tags"><span>${city}, ${region}</span></div></div><a href="/event/prueba">Más</a></div>`;
  const html = card("Sabaneta", "ANT", 1) + card("Barbosa", "SAN", 1) + card("Medellín", "ANT", 29) + card("Medellín", "ANT", 8);
  const events = sources.parseTiqueteraCards(html, "https://latiquetera.com/", "", helpers);
  assert.equal(events.length, 1);
  assert.equal(events[0].city, "Sabaneta");
});
test("one failed source does not discard a successful independent source", async (t) => {
  const mamm = '<div class="card-eventos"><h3>Prueba</h3><p class="date">17 de noviembre 2099</p><a href="/producto/prueba/">Más</a></div>';
  t.mock.method(globalThis, "fetch", async (url) => {
    if (url === sources.SOURCES[0].url) return new Response(mamm);
    throw new Error("Fuente temporalmente caída");
  });
  const api = agenda.createAgenda({ pool: { query: async () => ({ rows: [] }) }, sendJson() {}, parseJsonBody() {} });
  const sync = await api.sync();
  assert.equal(sync.sources.length, 6);
  assert.equal(sync.sources.filter((s) => s.ok).length, 1);
  assert.equal(sync.sources.find((s) => s.id === "mamm").count, 1);
});
test("public catalog hides closed events, unauthorized images and internal reviewer identity", async () => {
  const event = { name: "Prueba", date: agenda.today(), endDate: agenda.today(), time: "Horario por confirmar", city: "Sabaneta", category: "arte", audience: "publico", image: "https://example.org/poster.jpg", imageRightsConfirmed: false, checkedBy: "asesor-interno", referenceChecked: true };
  const row = (id, data) => ({ id, payload: JSON.stringify(data), status: "activo", source_kind: "manual", updated_at: new Date().toISOString() });
  let result;
  const api = agenda.createAgenda({ pool: { query: async () => ({ rows: [row("1", event), row("2", { ...event, audience: "restringido" }), row("3", { ...event, imageRightsConfirmed: true, imageAuthorization: "Permiso registrado" })] }) }, sendJson: (_, status, data) => { result = { status, data }; }, parseJsonBody() {} });
  await api.handle({ method: "GET" }, {}, new URL("https://parchar.test/api/events"));
  assert.equal(result.data.items.length, 2);
  assert.equal(result.data.items[0].image, "");
  assert.equal(result.data.items[1].image, event.image);
  assert.equal("checkedBy" in result.data.items[0], false);
  assert.equal("imageAuthorization" in result.data.items[1], false);
});
test("private organizer needs an internal reference check before publication", async () => {
  const body = { name: "Prueba privada", date: agenda.today(), city: "Bello", category: "musica", sourceUrl: "https://example.org/evento", organizerType: "privado", status: "activo" };
  let status;
  const api = agenda.createAgenda({ pool: { query: async () => ({ rows: [] }) }, sendJson: (_, code) => { status = code; }, parseJsonBody: async () => body });
  await api.handle({ method: "POST" }, {}, new URL("https://parchar.test/api/admin/events"), { staff: { username: "asesor" } });
  assert.equal(status, 400);
});

test("duplicates normalize city suffixes but preserve different event dates", () => {
  const event = { name: "Bobicraftmanía en vivo Medellín", date: "2026-11-15", city: "Medellín" };
  assert.equal(agenda.duplicateKey(event), agenda.duplicateKey({ ...event, name: "Bobicraftmania" }));
  assert.notEqual(agenda.duplicateKey(event), agenda.duplicateKey({ ...event, date: "2026-11-16" }));
});

test("an image authorization flag without a recorded permission never exposes the image", async () => {
  let data;
  const event = { name: "Prueba", date: agenda.today(), endDate: agenda.today(), city: "Medellín", category: "arte", time: "Todo el día", image: "https://example.org/foto.jpg", imageRightsConfirmed: true };
  const api = agenda.createAgenda({ pool: { query: async () => ({ rows: [{ id: "1", payload: JSON.stringify(event), status: "activo", source_kind: "manual", updated_at: new Date().toISOString() }] }) }, sendJson: (_, status, result) => { data = result; }, parseJsonBody() {} });
  await api.handle({ method: "GET" }, {}, new URL("https://parchar.test/api/events"));
  assert.equal(data.items[0].image, "");
});
