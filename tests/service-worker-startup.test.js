const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function workerWithCache(entries, fetchResponse) {
  const handlers = {};
  const writes = [];
  const cache = {
    match: async (request) => entries[new URL(typeof request === "string" ? request : request.url, "https://parchar.test").pathname]?.clone(),
    put: async (request, response) => writes.push({ request, response }),
  };
  const context = {
    URL,
    fetch: fetchResponse,
    caches: { open: async () => cache },
    self: {
      location: { origin: "https://parchar.test" },
      addEventListener: (type, handler) => { handlers[type] = handler; },
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../public/service-worker.js"), "utf8"), context);
  return {
    writes,
    request(url, mode = "navigate") {
      let response;
      const background = [];
      handlers.fetch({
        request: { url: `https://parchar.test${url}`, method: "GET", mode },
        respondWith: (promise) => { response = promise; },
        waitUntil: (promise) => background.push(promise),
      });
      return { response, background };
    },
  };
}

test("installed launch shows the cached logo while the host is still waking", async () => {
  let finishNetwork;
  const worker = workerWithCache({ "/loading.html": new Response("cached logo") }, () => new Promise((resolve) => { finishNetwork = resolve; }));
  const event = worker.request("/index.html?source=pwa");
  const text = await Promise.race([
    event.response.then((response) => response.text()),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Startup waited for the host")), 300)),
  ]);
  assert.equal(text, "cached logo");
  finishNetwork(new Response("<h1>Render waiting</h1>"));
  await Promise.all(event.background);
  assert.equal(worker.writes.length, 0);
});

test("cached scripts load immediately and hosting HTML cannot overwrite them", async () => {
  const worker = workerWithCache({ "/brand.js": new Response("cached brand") }, async () => new Response("Render waiting", { headers: { "content-type": "text/html" } }));
  const event = worker.request("/brand.js?v=93", "cors");
  assert.equal(await (await event.response).text(), "cached brand");
  await Promise.all(event.background);
  assert.equal(worker.writes.length, 0);
});

test("home navigation keeps its destination and refreshes valid Parchar HTML", async () => {
  const worker = workerWithCache({ "/index.html": new Response("cached home") }, async () => new Response('<body class="theme-body home-body">updated home</body>'));
  const event = worker.request("/index.html");
  assert.equal(await (await event.response).text(), "cached home");
  await Promise.all(event.background);
  assert.equal(worker.writes.length, 1);
});
