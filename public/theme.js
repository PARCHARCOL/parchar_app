const toneStorageKey = "parchar-background-tone";
const readingScaleStorageKey = "parchar-reading-scale-v1";

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
