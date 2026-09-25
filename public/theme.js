const toneStorageKey = "parchar-background-tone";
const readingSizeStorageKey = "parchar-reading-size";
const readingSizes = new Set(["normal", "large", "larger"]);

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

let savedReadingSize = "normal";
try {
  const storedSize = localStorage.getItem(readingSizeStorageKey);
  if (readingSizes.has(storedSize)) savedReadingSize = storedSize;
} catch {
  // Keep the default size when storage is unavailable.
}

function applyReadingSize(value) {
  const size = readingSizes.has(value) ? value : "normal";
  document.documentElement.dataset.readingSize = size;
  document.querySelectorAll("[data-reading-size]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.readingSize === size));
  });
  return size;
}

applyReadingSize(savedReadingSize);

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-reading-size]").forEach((button) => {
    button.addEventListener("click", () => {
      const size = applyReadingSize(button.dataset.readingSize);
      try {
        localStorage.setItem(readingSizeStorageKey, size);
      } catch {
        // Keep the selected size until this page is closed.
      }
    });
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
