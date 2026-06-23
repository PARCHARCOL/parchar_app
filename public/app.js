const buttons = document.querySelectorAll(".action-btn");
const statusEl = document.querySelector("#location-status");

const installButton = document.querySelector("#install-app-btn");
const installHelpButton = document.querySelector("#install-help-btn");
const installHint = document.querySelector("#install-hint");
const installGuide = document.querySelector("#install-guide");
const installGuideText = document.querySelector("#install-guide-text");
const installGuideClose = document.querySelector("#install-guide-close");

let deferredInstallPrompt = null;

function updateStatus(message) {
  if (!statusEl) return;
  statusEl.textContent = message;
}

function redirectWithCategory(category, coords) {
  const url = new URL("/places.html", window.location.origin);
  url.searchParams.set("category", category);

  if (coords) {
    url.searchParams.set("lat", String(coords.latitude));
    url.searchParams.set("lng", String(coords.longitude));
  }

  window.location.href = url.toString();
}

function handleCategory(route) {
  if (route === "clientes") {
    window.location.href = "/clients.html";
    return;
  }

  if (!navigator.geolocation) {
    updateStatus(
      "No se pudo leer tu ubicacion. Te mostrare sitios generales por categoria."
    );
    redirectWithCategory(route, null);
    return;
  }

  updateStatus("Buscando tu ubicacion para mostrar lugares cercanos...");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      updateStatus("Ubicacion lista. Abriendo resultados...");
      redirectWithCategory(route, position.coords);
    },
    () => {
      updateStatus(
        "No autorizaste ubicacion. Te mostrare sitios generales por categoria."
      );
      redirectWithCategory(route, null);
    },
    {
      enableHighAccuracy: true,
      timeout: 7000,
      maximumAge: 0,
    }
  );
}

function isIosDevice() {
  const ua = window.navigator.userAgent || "";
  const iOS = /iPad|iPhone|iPod/i.test(ua);
  const iPadOS =
    window.navigator.platform === "MacIntel" &&
    window.navigator.maxTouchPoints > 1;

  return iOS || iPadOS;
}

function isAndroidDevice() {
  return /Android/i.test(
    window.navigator.userAgent || ""
  );
}

function isLikelyInAppBrowser() {
  const ua =
    window.navigator.userAgent || "";

  return /FBAN|FBAV|Instagram|Line|WhatsApp|wv/i.test(ua);
}

function isStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function setInstallMessage(text) {
  if (!installHint) return;
  installHint.textContent = text;
}

function showInstallGuide(customText) {
  if (!installGuide || !installGuideText) return;
  installGuide.hidden = false;

  if (customText) {
    installGuideText.textContent = customText;
  }
}

function hideInstallGuide() {
  if (!installGuide) return;
  installGuide.hidden = true;
}

function setInstalledState() {
  if (installButton) {
    installButton.textContent = "App instalada";
    installButton.disabled = true;
  }

  if (installHelpButton) {
    installHelpButton.disabled = false;
  }

  setInstallMessage("Parchar ya esta instalada en este dispositivo.");
}

function setIosInstallState() {
  if (installButton) {
    installButton.textContent = "Instalar en iPhone";
    installButton.disabled = false;
  }

  setInstallMessage(
    "En iPhone abre en Safari y toca Compartir > Agregar a pantalla de inicio."
  );
}

function setAndroidInAppState() {
  if (installButton) {
    installButton.textContent = "Abrir en Chrome";
    installButton.disabled = false;
  }

  setInstallMessage(
    "Para instalar en Android, abre este link en Chrome. No instales desde WhatsApp."
  );
}

function setPromptInstallState() {
  if (installButton) {
    installButton.textContent = "Descargar app";
    installButton.disabled = false;
  }

  setInstallMessage("Instala Parchar y abrela como app desde tu pantalla.");
}

function setManualInstallState() {
  if (installButton) {
    installButton.textContent = "Como instalar";
    installButton.disabled = false;
  }

  setInstallMessage("Tu navegador no muestra instalacion directa. Usa la guia.");
}

async function triggerInstallPrompt() {
  if (isStandaloneMode()) {
    setInstalledState();
    return;
  }

  if (
    isAndroidDevice() &&
    isLikelyInAppBrowser()
  ) {
    showInstallGuide(
      "Android: toca los tres puntos de esta ventana y elige Abrir en Chrome. Luego toca Descargar app."
    );
    return;
  }

  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const result = await deferredInstallPrompt.userChoice;

    if (result.outcome === "accepted") {
      setInstallMessage("Instalando Parchar...");
    } else {
      setInstallMessage("Puedes instalarla cuando quieras desde este boton.");
    }

    deferredInstallPrompt = null;
    return;
  }

  if (isIosDevice()) {
    showInstallGuide(
      "Paso a paso en iPhone: 1) abre en Safari, 2) toca Compartir, 3) elige Agregar a pantalla de inicio."
    );
    return;
  }

  showInstallGuide(
    "En Android o escritorio, abre el menu del navegador y busca Instalar app o Agregar a pantalla de inicio."
  );
}

function setupInstallFlow() {
  if (!installButton) {
    return;
  }

  if (isStandaloneMode()) {
    setInstalledState();
  } else if (
    isAndroidDevice() &&
    isLikelyInAppBrowser()
  ) {
    setAndroidInAppState();
  } else if (isIosDevice()) {
    setIosInstallState();
  } else {
    setManualInstallState();
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    setPromptInstallState();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    setInstalledState();
    hideInstallGuide();
  });

  installButton.addEventListener("click", async () => {
    try {
      await triggerInstallPrompt();
    } catch {
      setInstallMessage("No se pudo abrir el instalador en este momento.");
    }
  });

  installHelpButton?.addEventListener("click", () => {
    if (
      isAndroidDevice() &&
      isLikelyInAppBrowser()
    ) {
      showInstallGuide(
        "Android: en WhatsApp, Facebook o Instagram, toca los tres puntos y abre el link en Chrome. Desde Chrome toca Descargar app."
      );
      return;
    }

    if (isIosDevice()) {
      showInstallGuide(
        "Paso a paso en iPhone: 1) abre en Safari, 2) toca Compartir, 3) elige Agregar a pantalla de inicio."
      );
      return;
    }

    showInstallGuide(
      "En Android/PC: abre el menu del navegador y elige Instalar app o Agregar a pantalla de inicio."
    );
  });

  installGuideClose?.addEventListener("click", () => {
    hideInstallGuide();
  });
}

for (const button of buttons) {
  button.addEventListener("click", () => {
    const route = button.dataset.route;
    handleCategory(route);
  });
}

setupInstallFlow();
