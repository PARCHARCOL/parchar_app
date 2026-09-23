const toneStorageKey = "parchar-background-tone";

function applyBackgroundTone(value) {
  const tone = Math.min(100, Math.max(0, Number(value) || 0));
  document.documentElement.style.setProperty("--tone-mix", `${Math.round(tone * 0.38)}%`);
  return tone;
}

let savedTone = 0;
try {
  savedTone = Number(localStorage.getItem(toneStorageKey)) || 0;
} catch {
  // Private browsing may block storage; the control still works for this visit.
}
applyBackgroundTone(savedTone);

document.addEventListener("DOMContentLoaded", () => {
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
