const UPDATE_CHECK_INTERVAL_MS =
  30 * 60 * 1000;

let updateRegistration = null;
let updateDismissed = false;
let updateReloading = false;
let updateRequested = false;
let updateFallbackTimer = null;
const hadServiceWorkerController =
  Boolean(
    navigator.serviceWorker?.controller
  );

function ensureUpdateBanner() {
  let banner = document.querySelector(
    "#app-update-banner"
  );

  if (banner) {
    return banner;
  }

  banner = document.createElement("section");
  banner.id = "app-update-banner";
  banner.className = "app-update-banner";
  banner.hidden = true;
  banner.setAttribute(
    "aria-live",
    "polite"
  );
  banner.innerHTML = `
    <div>
      <strong>Nueva version disponible</strong>
      <span>Actualiza Parchar para ver los ultimos cambios.</span>
    </div>
    <button id="app-update-now" type="button" class="submit-btn">
      Actualizar ahora
    </button>
    <button id="app-update-later" type="button" class="ghost-btn">
      Despues
    </button>
  `;

  document.body.appendChild(banner);

  banner
    .querySelector("#app-update-now")
    ?.addEventListener("click", () => {
      updateRequested = true;
      const updateButton = banner.querySelector(
        "#app-update-now"
      );
      if (updateButton) {
        updateButton.disabled = true;
        updateButton.textContent = "Actualizando...";
      }

      const waitingWorker =
        updateRegistration?.waiting;

      if (!waitingWorker) {
        reloadForUpdate();
        return;
      }

      waitingWorker.postMessage({
        type: "SKIP_WAITING",
      });

      window.clearTimeout(updateFallbackTimer);
      updateFallbackTimer = window.setTimeout(
        reloadForUpdate,
        5000
      );
    });

  banner
    .querySelector("#app-update-later")
    ?.addEventListener("click", () => {
      updateDismissed = true;
      banner.hidden = true;
    });

  return banner;
}

function reloadForUpdate() {
  if (updateReloading) {
    return;
  }

  updateReloading = true;
  window.clearTimeout(updateFallbackTimer);
  window.location.reload();
}

function showUpdateBanner(registration) {
  if (updateDismissed) {
    return;
  }

  updateRegistration = registration;
  ensureUpdateBanner().hidden = false;
}

function watchInstallingWorker(
  registration
) {
  const worker = registration.installing;

  if (!worker) {
    return;
  }

  worker.addEventListener(
    "statechange",
    () => {
      if (
        worker.state === "installed" &&
        navigator.serviceWorker.controller
      ) {
        showUpdateBanner(registration);
      }
    }
  );
}

async function registerUpdateWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registration =
      await navigator.serviceWorker.register(
        "/service-worker.js",
        {
          scope: "/",
          updateViaCache: "none",
        }
      );

    updateRegistration = registration;

    if (registration.waiting) {
      showUpdateBanner(registration);
    }

    registration.addEventListener(
      "updatefound",
      () =>
        watchInstallingWorker(
          registration
        )
    );

    await registration.update();

    window.setInterval(
      () => registration.update(),
      UPDATE_CHECK_INTERVAL_MS
    );

    document.addEventListener(
      "visibilitychange",
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          registration.update();
        }
      }
    );
  } catch {
    // La app sigue funcionando aunque falle la comprobacion.
  }
}

navigator.serviceWorker?.addEventListener(
  "controllerchange",
  () => {
    if (
      (!hadServiceWorkerController && !updateRequested) ||
      updateReloading
    ) {
      return;
    }

    reloadForUpdate();
  }
);

if (document.readyState === "loading") {
  window.addEventListener(
    "DOMContentLoaded",
    registerUpdateWorker
  );
} else {
  registerUpdateWorker();
}
