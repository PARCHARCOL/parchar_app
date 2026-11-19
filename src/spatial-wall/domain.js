import rules from "../../lib/spatial-rules.js";
export const { TOPICS, CITIES, LIFETIMES } = rules;
export const BOARD = { width: 3040, height: 2860 };
export const editionPeriod = () =>
  Number(
    new Intl.DateTimeFormat("en", {
      timeZone: "America/Bogota",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  ) >= 18 ||
  Number(
    new Intl.DateTimeFormat("en", {
      timeZone: "America/Bogota",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  ) < 6
    ? "night"
    : "morning";
export function readLocal(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
export function saveLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
export function session() {
  const saved = readLocal("parchar_client_session", {});
  return typeof saved?.token === "string" ? saved : {};
}
export async function api(path, options = {}) {
  const token = session().token,
    response = await fetch(`/api/creative${path}`, {
      ...options,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || "No se pudo completar la operación.");
    error.status = response.status;
    throw error;
  }
  return data;
}
export function islandOrigin(index) {
  return { x: 80 + (index % 2) * 1500, y: 70 + Math.floor(index / 2) * 1400 };
}
export function layoutPosts(posts) {
  // A fixed slot grid keeps each node in place when a filter hides its neighbors.
  const counts = {};
  return posts.map((post) => {
    const topic = TOPICS.findIndex((t) => t.id === post.topic),
      index = Math.max(0, topic),
      slot = counts[index] || 0;
    counts[index] = slot + 1;
    const origin = islandOrigin(index),
      weight = Math.min(3, Math.floor(Number(post.contributions || 0) / 3));
    return {
      ...post,
      x: origin.x + (slot % 3) * 390,
      y: origin.y + 100 + Math.floor(slot / 3) * 300,
      width: 310 + weight * 10,
      height: 230 + weight * 8,
    };
  });
}
export function filterPosts(posts, { city, reach, depth }, now = Date.now()) {
  return posts.filter(
    (p) =>
      (!p.expiresAt || Date.parse(p.expiresAt) > now) &&
      p.depth >= depth &&
      (!city ||
        reach === 100 ||
        p.city === city ||
        (reach === 50 &&
          CITIES.slice(0, 10).includes(p.city) &&
          CITIES.slice(0, 10).includes(city))),
  );
}
export function lifeLabel(post, now = Date.now()) {
  if (!post.expiresAt) return "Permanente";
  const ms =
    Date.parse(post.expiresAt) - Math.max(now, Date.parse(post.createdAt) || 0);
  if (ms <= 0) return "Finalizó";
  const minutes = Math.ceil(ms / 60000);
  return minutes < 60
    ? `Expira en ${minutes} min`
    : minutes < 1440
      ? `Expira en ${Math.ceil(minutes / 60)} h`
      : `Expira en ${Math.ceil(minutes / 1440)} días`;
}
export function nodeReducer(state, action) {
  if (action.type === "visit")
    return state.includes(action.id)
      ? state
      : [...state, action.id].slice(-1000);
  if (action.type === "restore")
    return Array.isArray(action.ids)
      ? action.ids.filter((id) => typeof id === "string").slice(-1000)
      : [];
  return state;
}
