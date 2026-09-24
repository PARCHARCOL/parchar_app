const test = require("node:test");
const assert = require("node:assert/strict");
const { distanceKm, nearLineKm } = require("../bike-routes");

test("distanceKm reports zero for identical coordinates", () => {
  const point = { lat: 6.2442, lng: -75.5812 };
  assert.equal(distanceKm(point, point), 0);
});

test("nearLineKm measures proximity to the whole line", () => {
  const route = {
    type: "LineString",
    coordinates: [[-75.6, 6.24], [-75.56, 6.24]],
  };
  assert.ok(nearLineKm({ lat: 6.24, lng: -75.58 }, route) < 0.01);
  assert.ok(nearLineKm({ lat: 6.25, lng: -75.58 }, route) > 1);
});
