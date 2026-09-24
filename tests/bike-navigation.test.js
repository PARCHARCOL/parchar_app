const test = require("node:test");
const assert = require("node:assert/strict");
const {
  nearestOnRoute,
  nearestEndDirection,
  buildCyclingRouteUrl,
  routeWaypoints,
  formatManeuver,
  instructionAtDistance,
  nextManeuverAtDistance,
} = require("../public/bike-navigation");

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

test("builds a real cycling-router request from two coordinates", () => {
  const url = new URL(buildCyclingRouteUrl(
    { lat: 6.2, lng: -75.6 },
    { lat: 6.21, lng: -75.59 },
  ));
  assert.equal(url.hostname, "routing.openstreetmap.de");
  assert.equal(url.pathname.split("/")[1], "routed-bike");
  assert.equal(url.searchParams.get("geometries"), "geojson");
  assert.equal(url.searchParams.get("steps"), "true");
  const viaUrl = new URL(buildCyclingRouteUrl(
    { lat: 6.2, lng: -75.6 },
    { lat: 6.22, lng: -75.58 },
    [{ lat: 6.21, lng: -75.59 }],
  ));
  assert.equal(viaUrl.pathname.split("/").at(-1).split(";").length, 3);
  assert.equal(buildCyclingRouteUrl({ lat: 91, lng: -75 }, { lat: 6, lng: -75 }), null);
});

test("samples the complete published route in either riding direction", () => {
  const forward = routeWaypoints(line, 1, 3);
  const reverse = routeWaypoints(line, -1, 3);
  assert.equal(forward.length, 3);
  assert.deepEqual(forward[0], { lat: 6.2, lng: -75.6 });
  assert.deepEqual(forward.at(-1), { lat: 6.2, lng: -75.58 });
  assert.deepEqual(reverse[0], forward.at(-1));
  assert.deepEqual(reverse.at(-1), forward[0]);
});

test("turn instructions are Spanish and progress selects the active step", () => {
  const steps = [
    { distance: 100, name: "Calle 10", maneuver: { type: "depart" } },
    { distance: 200, name: "Carrera 52", maneuver: { type: "turn", modifier: "right" } },
  ];
  assert.equal(formatManeuver(steps[1]), "Gira a la derecha por Carrera 52");
  assert.equal(instructionAtDistance(steps, 150), "Gira a la derecha por Carrera 52");
  assert.deepEqual(nextManeuverAtDistance(steps, 20), {
    instruction: "Gira a la derecha por Carrera 52",
    distanceMeters: 80,
  });
});
