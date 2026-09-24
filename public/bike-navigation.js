(function (root) {
  const METERS_PER_DEGREE = 111320;

  function distanceMeters(a, b) {
    const latitude = (a.lat + b.lat) * Math.PI / 360;
    return Math.hypot(
      (b.lng - a.lng) * METERS_PER_DEGREE * Math.cos(latitude),
      (b.lat - a.lat) * METERS_PER_DEGREE
    );
  }

  function pointsFromGeometry(geometry) {
    if (geometry?.type !== "LineString" || !Array.isArray(geometry.coordinates)) return null;
    const points = geometry.coordinates.map((coordinate) => ({
      lat: Number(coordinate[1]), lng: Number(coordinate[0]),
    }));
    if (points.length < 2 || points.some((point) =>
      !Number.isFinite(point.lat) || !Number.isFinite(point.lng) ||
      Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180)) return null;
    return points;
  }

  function nearestOnRoute(geometry, position, direction = 1) {
    const points = pointsFromGeometry(geometry);
    if (!points || !Number.isFinite(position.lat) || !Number.isFinite(position.lng)) return null;
    const xScale = METERS_PER_DEGREE * Math.cos(position.lat * Math.PI / 180);
    let travelled = 0;
    let closest = null;
    for (let index = 1; index < points.length; index += 1) {
      const start = points[index - 1];
      const end = points[index];
      const ax = (start.lng - position.lng) * xScale;
      const ay = (start.lat - position.lat) * METERS_PER_DEGREE;
      const dx = (end.lng - start.lng) * xScale;
      const dy = (end.lat - start.lat) * METERS_PER_DEGREE;
      const length = Math.hypot(dx, dy);
      if (length < 0.01) continue;
      const fraction = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (length * length)));
      const crossTrackMeters = Math.hypot(ax + fraction * dx, ay + fraction * dy);
      if (!closest || crossTrackMeters < closest.crossTrackMeters) {
        closest = {
          crossTrackMeters,
          alongMeters: travelled + fraction * length,
          snapped: {
            lat: start.lat + fraction * (end.lat - start.lat),
            lng: start.lng + fraction * (end.lng - start.lng),
          },
        };
      }
      travelled += length;
    }
    if (!closest) return null;
    return {
      ...closest,
      totalMeters: travelled,
      remainingMeters: direction === -1 ? closest.alongMeters : travelled - closest.alongMeters,
    };
  }

  function nearestEndDirection(geometry, position) {
    const points = pointsFromGeometry(geometry);
    if (!points) return 1;
    return distanceMeters(position, points[0]) <= distanceMeters(position, points[points.length - 1])
      ? 1 : -1;
  }

  const api = { nearestOnRoute, nearestEndDirection };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.BikeNavigation = api;
})(typeof window !== "undefined" ? window : globalThis);
