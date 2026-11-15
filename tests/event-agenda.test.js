const test = require("node:test");
const assert = require("node:assert/strict");
const agenda = require("../lib/event-agenda");

test("today uses Colombia even after midnight UTC", () => {
  assert.equal(agenda.today(new Date("2026-11-16T02:00:00Z")), "2026-11-15");
});
test("filters a selected municipality exactly and includes weekend date overlaps", () => {
  const event = { name: "Concierto", date: "2026-11-14", endDate: "2026-11-15", city: "Medellín", category: "musica" };
  assert.equal(agenda.eventMatches(event, { date: "2026-11-15", city: "Sabaneta" }), false);
  assert.equal(agenda.eventMatches(event, { date: "2026-11-14", until: "2026-11-15", city: "Medellín", category: "musica" }), true);
  assert.equal(agenda.eventMatches(event, { date: "2026-11-16" }), false);
});
test("unknown recurrence is not converted into daily events", () => {
  const html = '<h1>Exposición de prueba</h1><p class="pec_event_page_sub_p">noviembre 1, 2026 a diciembre 20, 2026</p>';
  assert.deepEqual(agenda.parseSourceEvent(html, "https://example.org/event"), []);
});
test("imports only explicit recurrence dates, preserving the closing time", () => {
  const html = '<h1>Concierto de prueba</h1><p class="pec_event_page_sub_p">noviembre 15, 2026 6:30 pm - 8:30 pm</p><ul class="pec_event_page_action_menu"><li>noviembre 15, 2026</li><li>noviembre 22, 2026</li></ul>';
  const items = agenda.parseSourceEvent(html, "https://example.org/event");
  assert.deepEqual(items.map((e) => e.date), ["2026-11-15", "2026-11-22"]);
  assert.equal(items[0].endTime, "20:30");
});
test("source discovery rejects foreign hosts and removes duplicate event links", () => {
  const url = "https://agenda.patrimoniomedellin.gov.co/pec-events/prueba/123";
  const items = agenda.parseSourceListing(`<a href="${url}"></a><a href="${url}"></a><a href="https://evil.example/pec-events/1">Otro</a>`);
  assert.equal(items.length, 1);
  assert.equal(items[0].url, url);
});

test("imports complete calendar entries even when they are absent from the featured links", () => {
  const cell = '<div class="dp_pec_date" data-dppec-date="2026-11-16"><a class="dp_daily_event" data-dppec-event="42"><strong>10:00 am - 1:00 pm</strong></a><div class="eventsPreview"><li data-dppec-event="42"><span>10:00 am</span><i>Conversatorio de prueba</i><i>Biblioteca<br>Calle 1</i></li></div></div>';
  const items = agenda.parseSourceCalendar(cell + cell);
  assert.equal(items.length, 1);
  assert.equal(items[0].name, "Conversatorio de prueba");
  assert.equal(items[0].date, "2026-11-16");
  assert.equal(items[0].endTime, "13:00");
  assert.equal(items[0].venue, "Biblioteca Calle 1");
  assert.equal(items[0].sourceUrl, "https://agenda.patrimoniomedellin.gov.co/?p=42");
});
test("rejects invalid dates and unsafe event reference links", () => {
  const event = { name: "Prueba", city: "Sabaneta", category: "arte", date: "2026-11-16", sourceUrl: "https://example.org/event" };
  assert.equal(agenda.normalizeEvent(event).city, "Sabaneta");
  assert.throws(() => agenda.normalizeEvent({ ...event, date: "2026-02-30" }));
  assert.throws(() => agenda.normalizeEvent({ ...event, sourceUrl: "javascript:alert(1)" }));
  assert.throws(() => agenda.normalizeEvent({ ...event, city: "Bogotá" }));
});
test("a repeated event is identified by name, date and municipality, not source URL", () => {
  const event = { name: "Concierto", date: "2026-11-15", city: "Medellín" };
  assert.equal(agenda.eventId(event), agenda.eventId({ ...event, name: "CONCIERTO", sourceUrl: "https://example.org" }));
  assert.notEqual(agenda.eventId(event), agenda.eventId({ ...event, city: "Bello" }));
});
