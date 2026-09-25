const test = require("node:test");
const assert = require("node:assert/strict");

const {
  rankTrendingRecommendations,
} = require("../recommendation-ranking");

test("ranks recent engagement and keeps different categories in the first row", () => {
  const sites = [
    { id: 1, name: "Pueblo nuevo", site_type: "pueblo", status: "activo", created_at: "2026-09-24" },
    { id: 2, name: "Mirador", site_type: "mirador", status: "activo", created_at: "2026-09-20" },
    { id: 3, name: "Otro pueblo", site_type: "pueblo", status: "activo", created_at: "2026-09-25" },
  ];
  const businesses = [
    { id: 7, business_name: "Restaurante", category: "restaurante", status: "activo", created_at: "2026-09-19" },
    { id: 8, business_name: "Bar", category: "bar", status: "activo", created_at: "2026-09-18" },
  ];
  const events = [
    { entity_type: "site", entity_id: 2, event_type: "route", event_count: 3 },
    { entity_type: "business", entity_id: 8, event_type: "view", event_count: 1 },
  ];

  const result = rankTrendingRecommendations(sites, businesses, events);

  assert.deepEqual(result.items.map((item) => item.id), [2, 8, 3, 7]);
  assert.equal(new Set(result.items.map((item) => item.category)).size, 4);
  assert.equal(result.hasTrendSignals, true);
});

test("uses newest active entries as fallback when engagement is absent", () => {
  const sites = [
    { id: 1, name: "Old", site_type: "pueblo", status: "activo", created_at: "2026-08-01" },
    { id: 2, name: "New", site_type: "pueblo", status: "activo", created_at: "2026-09-25" },
    { id: 3, name: "Paused", site_type: "mirador", status: "pausado", created_at: "2026-09-25" },
  ];

  const result = rankTrendingRecommendations(sites, [], []);

  assert.deepEqual(result.items.map((item) => item.id), [2, 1]);
  assert.equal(result.hasTrendSignals, false);
});
