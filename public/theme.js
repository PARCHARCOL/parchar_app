const toneStorageKey = "parchar-background-tone";
const readingScaleStorageKey = "parchar-reading-scale-v1";
const seasonalThemeStorageKey = "parchar-seasonal-theme-v1";
const standardDesignStorageKey = "parchar-standard-design-v1";
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

function applyStandardDesign(design) {
  const root = document.documentElement;
  const keys = ["pageStart", "pageEnd", "shellStart", "shellEnd", "accent", "text", "softText", "line"];
  const valid = design && typeof design.id === "string" && keys.every((key) => /^#[0-9a-f]{6}$/i.test(design[key] || ""));
  if (!valid) return;
  root.dataset.standardDesign = design.id;
  root.style.setProperty("--standard-page-start", design.pageStart);
  root.style.setProperty("--standard-page-end", design.pageEnd);
  root.style.setProperty("--standard-shell-start", design.shellStart);
  root.style.setProperty("--standard-shell-end", design.shellEnd);
  root.style.setProperty("--standard-accent", design.accent);
  root.style.setProperty("--standard-text", design.text);
  root.style.setProperty("--standard-soft-text", design.softText);
  root.style.setProperty("--standard-line", design.line);
}

try {
  const cachedDesign = localStorage.getItem(standardDesignStorageKey);
  if (cachedDesign) applyStandardDesign(JSON.parse(cachedDesign));
} catch {
  // Use the default Parchar design when local storage is unavailable.
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

async function refreshStandardDesign() {
  try {
    const response = await fetch("/api/design/standard", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    if (!data.design) return;
    applyStandardDesign(data.design);
    localStorage.setItem(standardDesignStorageKey, JSON.stringify(data.design));
  } catch {
    // Keep the last downloaded design, or the built-in Parchar design.
  }
}

refreshStandardDesign();
window.addEventListener("focus", refreshStandardDesign);
window.setInterval(refreshStandardDesign, 30 * 1000);

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
  return Math.min(200, Math.max(100, Math.round(Number(value) / 5) * 5));
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

let savedReadingScale = 115;
try {
  const storedScale = Number(localStorage.getItem(readingScaleStorageKey));
  if (Number.isFinite(storedScale) && storedScale >= 100 && storedScale <= 200) {
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
  document.documentElement.classList.toggle("reading-scale-large", scale >= 150);
  const output = document.querySelector("#reading-scale-value");
  if (output) output.textContent = `${scale}%`;
  return scale;
}

applyReadingScale(savedReadingScale);

document.addEventListener("DOMContentLoaded", () => {
  const topStrip = document.querySelector(".top-strip");
  if (topStrip && !document.querySelector(".reading-accessibility")) {
    const controls = document.createElement("section");
    controls.className = "reading-accessibility";
    controls.setAttribute("aria-label", "Ajustar el tamaño del texto");
    controls.innerHTML = `
      <span class="reading-accessibility-label">Tamaño del texto</span>
      <button type="button" data-reading-adjust="-20" aria-label="Disminuir el tamaño del texto">A−</button>
      <output id="reading-scale-value" aria-live="polite">${savedReadingScale}%</output>
      <button type="button" data-reading-adjust="20" aria-label="Aumentar el tamaño del texto">A+</button>
    `;
    topStrip.insertAdjacentElement("afterend", controls);
    controls.addEventListener("click", (event) => {
      const button = event.target.closest("[data-reading-adjust]");
      if (!button) return;
      const scale = applyReadingScale(Number(document.documentElement.style.fontSize.replace("%", "")) + Number(button.dataset.readingAdjust));
      try {
        localStorage.setItem(readingScaleStorageKey, String(scale));
      } catch {
        // Keep the selected size until this page is closed.
      }
    });
  }

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
