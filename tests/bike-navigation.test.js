const test = require("node:test");
const assert = require("node:assert/strict");
const { nearestOnRoute, nearestEndDirection } = require("../public/bike-navigation");

const line = {
  type: "LineString",
  coordinates: [[-75.6, 6.2], [-75.59, 6.2], [-75.58, 6.2]],
};

test("projects a position onto the route and measures either direction", () => {
  const position = { lat: 6.2, lng: -75.59 };
  const forward = nearestOnRoute(line, position, 1);
  const reverse = nearestOnRoute(line, position, -1);
  assert.ok(forward.crossTrackMeters < 1);
  assert.ok(Math.abs(forward.remainingMeters - reverse.remainingMeters) < 2);
  assert.ok(forward.totalMeters > 2000);
});

test("remaining distance decreases toward the selected end", () => {
  const start = nearestOnRoute(line, { lat: 6.2, lng: -75.6 });
  const end = nearestOnRoute(line, { lat: 6.2, lng: -75.58 });
  assert.ok(start.remainingMeters > 2000);
  assert.ok(end.remainingMeters < 1);
});

test("projects an off-route rider onto the selected line", () => {
  const progress = nearestOnRoute(line, { lat: 6.201, lng: -75.595 });
  assert.ok(progress.crossTrackMeters > 100 && progress.crossTrackMeters < 120);
  assert.ok(Math.abs(progress.snapped.lat - 6.2) < 0.00001);
  assert.ok(Math.abs(progress.snapped.lng + 75.595) < 0.00001);
});

test("chooses a direction from the nearest endpoint", () => {
  assert.equal(nearestEndDirection(line, { lat: 6.2, lng: -75.599 }), 1);
  assert.equal(nearestEndDirection(line, { lat: 6.2, lng: -75.581 }), -1);
});

test("does not guide on disconnected or invalid geometry", () => {
  assert.equal(nearestOnRoute({ type: "MultiLineString", coordinates: [] }, { lat: 6.2, lng: -75.59 }), null);
});
