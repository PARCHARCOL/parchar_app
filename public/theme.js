const toneStorageKey = "parchar-background-tone";
const readingScaleStorageKey = "parchar-reading-scale-v1";
const seasonalThemeStorageKey = "parchar-seasonal-theme-v1";
const defaultSeasonalPalette = {
  id: "default",
  accent: "#e5c77a",
  surface: "#392074",
  deep: "#1c0a39",
  border: "#bb7aff",
};

function applySeasonalTheme(theme) {
  const safeTheme = theme && ["accent", "surface", "deep", "border"].every((key) => /^#[0-9a-f]{6}$/i.test(theme[key] || ""))
    ? theme
    : defaultSeasonalPalette;
  const root = document.documentElement;
  root.dataset.seasonalTheme = safeTheme.id || "default";
  root.style.setProperty("--season-accent", safeTheme.accent);
  root.style.setProperty("--season-surface", safeTheme.surface);
  root.style.setProperty("--season-deep", safeTheme.deep);
  root.style.setProperty("--season-border", safeTheme.border);
}

try {
  const cachedTheme = localStorage.getItem(seasonalThemeStorageKey);
  if (cachedTheme) applySeasonalTheme(JSON.parse(cachedTheme));
} catch {
  // The normal Parchar palette remains available if local storage is blocked.
}

async function refreshSeasonalTheme() {
  try {
    const response = await fetch("/api/design/seasonal", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    applySeasonalTheme(data.theme);
    if (data.theme) localStorage.setItem(seasonalThemeStorageKey, JSON.stringify(data.theme));
    else localStorage.removeItem(seasonalThemeStorageKey);
  } catch {
    // Keep the last downloaded palette or fall back to Parchar's normal colors.
  }
}

refreshSeasonalTheme();
window.addEventListener("focus", refreshSeasonalTheme);

function scheduleSeasonalMonthRefresh() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  const nextMonthStart = Date.UTC(Number(parts.year), Number(parts.month), 1, 5);
  const delay = Math.max(1000, nextMonthStart - Date.now() + 1000);
  window.setTimeout(async () => {
    await refreshSeasonalTheme();
    scheduleSeasonalMonthRefresh();
  }, delay);
}

scheduleSeasonalMonthRefresh();

function clampReadingScale(value) {
  return Math.min(150, Math.max(100, Math.round(Number(value) / 5) * 5));
}

function applyBackgroundTone(value) {
  const tone = Math.min(100, Math.max(0, Number(value) || 0));
  document.documentElement.style.setProperty("--tone-mix", `${tone}%`);
  document.documentElement.dataset.toneContrast = tone >= 50 ? "light" : "dark";
  return tone;
}

let savedTone = 0;
try {
  savedTone = Number(localStorage.getItem(toneStorageKey)) || 0;
} catch {
  // Private browsing may block storage; the control still works for this visit.
}
applyBackgroundTone(savedTone);

let savedReadingScale = 100;
try {
  const storedScale = Number(localStorage.getItem(readingScaleStorageKey));
  if (Number.isFinite(storedScale) && storedScale >= 100 && storedScale <= 150) {
    savedReadingScale = Math.round(storedScale / 5) * 5;
  } else {
    const previousSize = localStorage.getItem("parchar-reading-size");
    if (previousSize === "large") savedReadingScale = 125;
    if (previousSize === "larger") savedReadingScale = 150;
  }
} catch {
  // Keep the default size when storage is unavailable.
}

function applyReadingScale(value) {
  const scale = clampReadingScale(value);
  document.documentElement.style.fontSize = `${scale}%`;
  document.documentElement.dataset.uiExpanded = String(scale >= 120);
  const slider = document.querySelector("#reading-scale-input");
  const output = document.querySelector("#reading-scale-value");
  if (slider && slider.value !== String(scale)) slider.value = String(scale);
  if (output) output.value = `${scale}%`;
  return scale;
}

applyReadingScale(savedReadingScale);

document.addEventListener("DOMContentLoaded", () => {
  const scaleSlider = document.querySelector("#reading-scale-input");
  scaleSlider?.addEventListener("input", () => {
    const scale = clampReadingScale(scaleSlider.value);
    applyReadingScale(scale);
    try {
      localStorage.setItem(readingScaleStorageKey, String(scale));
    } catch {
      // Keep the selected size until this page is closed.
    }
  });

  const slider = document.querySelector("#background-tone");
  if (!slider) return;

  slider.value = String(applyBackgroundTone(savedTone));
  slider.addEventListener("input", () => {
    applyBackgroundTone(slider.value);
    try {
      localStorage.setItem(toneStorageKey, slider.value);
    } catch {
      // Keep the selected tone until the page is closed.
    }
  });
});
