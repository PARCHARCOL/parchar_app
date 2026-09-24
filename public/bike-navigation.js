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

  function isRoutableGeometry(geometry) {
    return Boolean(pointsFromGeometry(geometry));
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
    const progressMeters = direction === -1 ? travelled - closest.alongMeters : closest.alongMeters;
    return {
      ...closest,
      totalMeters: travelled,
      progressMeters,
      remainingMeters: travelled - progressMeters,
    };
  }

  function nearestEndDirection(geometry, position) {
    const points = pointsFromGeometry(geometry);
    if (!points) return 1;
    return distanceMeters(position, points[0]) <= distanceMeters(position, points[points.length - 1])
      ? 1 : -1;
  }

  function buildCyclingRouteUrl(origin, destination, via = []) {
    const points = [origin, ...(Array.isArray(via) ? via : []), destination];
    if (points.length > 30) return null;
    if (points.some((point) => !Number.isFinite(Number(point?.lat)) ||
      !Number.isFinite(Number(point?.lng)) || Math.abs(Number(point.lat)) > 90 ||
      Math.abs(Number(point.lng)) > 180)) return null;
    const coordinates = points.map((point) =>
      `${Number(point.lng)},${Number(point.lat)}`
    ).join(";");
    const url = new URL(
      `https://routing.openstreetmap.de/routed-bike/route/v1/driving/${coordinates}`
    );
    url.searchParams.set("overview", "full");
    url.searchParams.set("geometries", "geojson");
    url.searchParams.set("steps", "true");
    url.searchParams.set("alternatives", "false");
    return url.toString();
  }

  function routeWaypoints(geometry, direction = 1, maxWaypoints = 24) {
    const points = pointsFromGeometry(geometry);
    if (!points) return null;
    const ordered = direction === -1 ? points.reverse() : points;
    const cumulative = [0];
    for (let index = 1; index < ordered.length; index += 1) {
      cumulative.push(cumulative[index - 1] + distanceMeters(ordered[index - 1], ordered[index]));
    }
    const totalMeters = cumulative[cumulative.length - 1];
    if (!Number.isFinite(totalMeters) || totalMeters < 1) return null;
    const count = Math.min(Math.max(2, Math.floor(maxWaypoints)), ordered.length);
    const sampled = [];
    for (let index = 0; index < count; index += 1) {
      const target = totalMeters * index / (count - 1);
      let pointIndex = 0;
      while (pointIndex < cumulative.length - 1 &&
        Math.abs(cumulative[pointIndex + 1] - target) < Math.abs(cumulative[pointIndex] - target)) pointIndex += 1;
      const point = ordered[pointIndex];
      if (!sampled.length || point.lat !== sampled[sampled.length - 1].lat || point.lng !== sampled[sampled.length - 1].lng) {
        sampled.push(point);
      }
    }
    return sampled;
  }

  function formatManeuver(step) {
    const maneuver = step?.maneuver || {};
    const directions = {
      straight: "sigue derecho",
      "slight right": "gira ligeramente a la derecha",
      right: "gira a la derecha",
      "sharp right": "gira cerrado a la derecha",
      uturn: "haz un retorno en U",
      "sharp left": "gira cerrado a la izquierda",
      left: "gira a la izquierda",
      "slight left": "gira ligeramente a la izquierda",
    };
    const actions = {
      depart: "Inicia",
      arrive: "Llegaste al punto de entrada",
      turn: directions[maneuver.modifier] || "Gira",
      "new name": "Continúa",
      continue: "Continúa",
      merge: "Incorpórate",
      ramp: "Toma la rampa",
      fork: "En la bifurcación",
      "end of road": "Al final de la vía",
      roundabout: "En la glorieta",
      rotary: "En la glorieta",
      notification: "Continúa",
    };
    const action = actions[maneuver.type] || "Continúa";
    const road = String(step?.name || "").trim();
    const instruction = road ? `${action} por ${road}` : action;
    return instruction.charAt(0).toLocaleUpperCase("es") + instruction.slice(1);
  }

  function instructionAtDistance(steps, distanceMeters) {
    if (!Array.isArray(steps) || !steps.length) return "Sigue el trazado azul.";
    let travelled = 0;
    for (const step of steps) {
      const length = Math.max(0, Number(step.distance) || 0);
      if (distanceMeters <= travelled + length) return formatManeuver(step);
      travelled += length;
    }
    return formatManeuver(steps[steps.length - 1]);
  }

  function nextManeuverAtDistance(steps, distanceMeters) {
    if (!Array.isArray(steps) || !steps.length) return null;
    const maneuverTypes = new Set(["turn", "fork", "end of road", "roundabout", "rotary", "ramp", "merge", "arrive"]);
    let travelled = 0;
    for (const step of steps) {
      if (travelled > distanceMeters && maneuverTypes.has(step?.maneuver?.type)) {
        return { instruction: formatManeuver(step), distanceMeters: travelled - distanceMeters };
      }
      travelled += Math.max(0, Number(step.distance) || 0);
    }
    return null;
  }

  const api = {
    nearestOnRoute,
    nearestEndDirection,
    isRoutableGeometry,
    buildCyclingRouteUrl,
    routeWaypoints,
    formatManeuver,
    instructionAtDistance,
    nextManeuverAtDistance,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.BikeNavigation = api;
})(typeof window !== "undefined" ? window : globalThis);
