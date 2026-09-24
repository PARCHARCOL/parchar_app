const buttons = document.querySelectorAll(".action-btn");
const statusEl = document.querySelector("#location-status");
const menuButton = document.querySelector("#home-menu-btn");
const alertsButton = document.querySelector("#home-alerts-btn");
const menuPanel = document.querySelector("#home-menu-panel");
const alertsPanel = document.querySelector("#home-alerts-panel");
const searchForm = document.querySelector("#home-search-form");
const searchInput = document.querySelector("#home-search");
const suggestionLinks = document.querySelectorAll("[data-suggestion-route]");
const burgerMasterPromotionElements = document.querySelectorAll(
  '[data-promotion="burgermaster"]'
);
const burgerMasterInfoElements = document.querySelectorAll(
  '[data-promotion-info="burgermaster"]'
);

const SITE_SEARCH_KEYWORDS = [
  "charco",
  "charcos",
  "mirador",
  "miradores",
  "pueblo",
  "pueblos",
  "puebliar",
  "puebliando",
  "escapada",
  "escapadas",
  "rio",
  "rios",
  "burgermaster",
  "burger master",
  "hamburguesa",
  "hamburguesas",
  "cascada",
  "cascadas",
  "naturaleza",
  "sendero",
  "sitio",
  "sitios",
  "bici",
  "bicicleta",
  "bicicletas",
  "cicloruta",
  "ciclorutas",
  "ciclista",
  "ciclistas",
  "ruta",
  "rutas",
  "moto",
  "motos",
  "motero",
  "motera",
  "rodada",
  "rodadas",
];

const installButton = document.querySelector("#install-app-btn");
const installHelpButton = document.querySelector("#install-help-btn");
const installHint = document.querySelector("#install-hint");
const installGuide = document.querySelector("#install-guide");
const installGuideText = document.querySelector("#install-guide-text");
const installGuideClose = document.querySelector("#install-guide-close");

let deferredInstallPrompt = null;
let burgerMasterPromotion = {
  active: false,
};
let coverageZones = [];
const monthNames = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function updateStatus(message) {
  if (!statusEl) return;
  statusEl.textContent = message;
}

function isBurgerMasterActive() {
  return Boolean(
    burgerMasterPromotion &&
      burgerMasterPromotion.active
  );
}

function syncBurgerMasterPromotion() {
  const isActive =
    isBurgerMasterActive();

  burgerMasterPromotionElements.forEach(
    (element) => {
      element.hidden = !isActive;

      if ("disabled" in element) {
        element.disabled = !isActive;
      }
    }
  );

  burgerMasterInfoElements.forEach(
    (element) => {
      element.classList.toggle(
        "is-promo-inactive",
        !isActive
      );
      element.setAttribute(
        "aria-disabled",
        String(!isActive)
      );
      element.title = isActive
        ? "BurgerMaster activo"
        : `BurgerMaster se realiza ${getBurgerMasterPromotionWhenText()}.`;
    }
  );
}

async function loadBurgerMasterPromotion() {
  syncBurgerMasterPromotion();

  try {
    const response = await fetch(
      "/api/promotions/burgermaster",
      {
        cache: "no-store",
      }
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "No se pudo leer BurgerMaster."
      );
    }

    burgerMasterPromotion =
      data.promotion || {
        active: false,
      };
  } catch {
    burgerMasterPromotion = {
      active: false,
    };
  }

  syncBurgerMasterPromotion();
}

function showBurgerMasterInactiveStatus() {
  updateStatus(
    `BurgerMaster en Medellin se realiza ${getBurgerMasterPromotionWhenText()}. El boton se activa cuando la promocion este vigente.`
  );
}

function getMonthNameFromDateOnly(value) {
  const month = Number(
    String(value || "").slice(5, 7)
  );

  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return "";
  }

  return monthNames[month - 1];
}

function getBurgerMasterPromotionWhenText() {
  const startMonth =
    getMonthNameFromDateOnly(
      burgerMasterPromotion.startDate
    );
  const endMonth =
    getMonthNameFromDateOnly(
      burgerMasterPromotion.endDate
    );

  if (
    startMonth &&
    endMonth &&
    startMonth !== endMonth
  ) {
    return `entre ${startMonth} y ${endMonth}`;
  }

  return `en ${startMonth || endMonth || "abril"}`;
}

function redirectWithCategory(category, coords) {
  const url = new URL("/places.html", window.location.origin);

  if (category === "walking") {
    url.searchParams.set("mode", "walking");
  } else {
    url.searchParams.set("category", category);
  }

  if (coords) {
    url.searchParams.set("lat", String(coords.latitude));
    url.searchParams.set("lng", String(coords.longitude));
  }

  window.location.href = url.toString();
}

function normalizeHomeSearch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function loadCoverageZones() {
  try {
    const response = await fetch(
      "/api/coverage/zones",
      {
        cache: "no-store",
      }
    );
    const data = await response.json();

    if (response.ok) {
      coverageZones = data.zones || [];
    }
  } catch {
    coverageZones = [];
  }
}

function findCoverageZoneFromSearch(query) {
  const normalized =
    normalizeHomeSearch(query);

  return (
    coverageZones.find((zone) => {
      const names = [
        zone.label,
        zone.municipality,
        ...(zone.aliases || []),
      ].map(normalizeHomeSearch);

      return names.some(
        (name) =>
          name && normalized === name
      );
    }) || null
  );
}

async function getCoverageStatus(coords) {
  if (!coords) {
    return null;
  }

  try {
    const url = new URL(
      "/api/coverage/status",
      window.location.origin
    );
    url.searchParams.set(
      "lat",
      String(coords.latitude)
    );
    url.searchParams.set(
      "lng",
      String(coords.longitude)
    );
    const response = await fetch(
      url.toString(),
      {
        cache: "no-store",
      }
    );
    const data = await response.json();

    return response.ok
      ? data.coverage
      : null;
  } catch {
    return null;
  }
}

async function showHomeCoverageHintIfOutside() {
  if (
    !navigator.geolocation ||
    !navigator.permissions
  ) {
    return;
  }

  try {
    const permission =
      await navigator.permissions.query({
        name: "geolocation",
      });

    if (permission.state !== "granted") {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coverage =
          await getCoverageStatus(
            position.coords
          );

        if (
          coverage &&
          !coverage.enabled
        ) {
          updateStatus(
            coverage.message
          );
        }
      },
      () => {},
      {
        enableHighAccuracy: false,
        timeout: 3500,
        maximumAge: 10 * 60 * 1000,
      }
    );
  } catch {
    // Sin permiso previo no se fuerza ningun popup de ubicacion.
  }
}

async function redirectWithSearch(query) {
  const cleanQuery = String(query || "").trim();

  if (!cleanQuery) {
    updateStatus("Escribe que quieres buscar.");
    searchInput?.focus();
    return;
  }

  if (!coverageZones.length) {
    await loadCoverageZones();
  }

  const normalizedQuery = normalizeHomeSearch(cleanQuery);
  const selectedZone =
    findCoverageZoneFromSearch(
      cleanQuery
    );

  if (selectedZone) {
    const url = new URL(
      "/places.html",
      window.location.origin
    );
    url.searchParams.set(
      "zone",
      selectedZone.slug
    );
    window.location.href =
      url.toString();
    return;
  }

  const shouldSearchSites = SITE_SEARCH_KEYWORDS.some((keyword) =>
    normalizedQuery.includes(keyword)
  );
  const isBikeSearch =
    /\b(bici|bicicleta|bicicletas|cicloruta|ciclorutas|ciclista|ciclistas)\b/.test(
      normalizedQuery
    );
  const isExplicitBurgerMasterSearch =
    /\b(burgermaster|burger master)\b/.test(
      normalizedQuery
    );
  const isHamburgerSearch =
    /\b(hamburguesa|hamburguesas)\b/.test(normalizedQuery);
  const isBurgerMasterSearch =
    isExplicitBurgerMasterSearch ||
    (isHamburgerSearch &&
      isBurgerMasterActive());
  const isCharcoSearch =
    /\b(charco|charcos|rio|rios|cascada|cascadas|quebrada|quebradas|salto|balneario)\b/.test(
      normalizedQuery
    );
  const isMiradorSearch =
    /\b(mirador|miradores|cerro|alto|vista|panoramica|panoramico)\b/.test(
      normalizedQuery
    );
  const isPuebliarSearch =
    /\b(pueblo|pueblos|puebliar|puebliando|escapada|escapadas|ruta|rutas|moto|motos|motero|motera|rodada|rodadas)\b/.test(
      normalizedQuery
    );
  const opensSitesSearch =
    shouldSearchSites &&
    (!isHamburgerSearch ||
      isBurgerMasterSearch);
  const url = new URL(
    opensSitesSearch ? "/sites.html" : "/places.html",
    window.location.origin
  );
  if (isBikeSearch) {
    url.searchParams.set("mode", "bike");
  } else if (isBurgerMasterSearch) {
    if (!isBurgerMasterActive()) {
      showBurgerMasterInactiveStatus();
      return;
    }

    url.searchParams.set("type", "burgermaster");
  } else if (isCharcoSearch) {
    url.searchParams.set("type", "charco");
  } else if (isMiradorSearch) {
    url.searchParams.set("type", "mirador");
  } else if (isPuebliarSearch) {
    url.searchParams.set("mode", "puebliar");
  } else if (isHamburgerSearch) {
    url.searchParams.set(
      "category",
      "restaurante"
    );
  }
  url.searchParams.set("q", cleanQuery);
  window.location.href = url.toString();
}

function handleCategory(route) {
  if (route === "clientes") {
    window.location.href = "/clients.html";
    return;
  }

  if (route === "social") {
    window.location.href = "/social.html";
    return;
  }

  if (route === "sitios" || route === "charcos") {
    window.location.href = "/sites.html?type=charco";
    return;
  }

  if (route === "miradores") {
    window.location.href = "/sites.html?type=mirador";
    return;
  }

  if (route === "burgermaster") {
    if (!isBurgerMasterActive()) {
      showBurgerMasterInactiveStatus();
      return;
    }

    window.location.href = "/sites.html?type=burgermaster";
    return;
  }

  if (route === "bici") {
    window.location.href = "/sites.html?mode=bike";
    return;
  }

  if (route === "puebliar") {
    window.location.href = "/sites.html?mode=puebliar";
    return;
  }

  if (!navigator.geolocation) {
    updateStatus(
      route === "walking"
        ? "Para mostrar locales a pie necesitamos tu ubicacion."
        : "No se pudo leer tu ubicacion. Te mostrare locales generales por categoria."
    );

    if (route !== "walking") {
      redirectWithCategory(route, null);
    }
    return;
  }

  updateStatus(
    route === "walking"
      ? "Buscando locales para ir caminando desde donde estas..."
      : "Buscando tu ubicacion para mostrar lugares cercanos..."
  );

  navigator.geolocation.getCurrentPosition(
    (position) => {
      updateStatus("Ubicacion lista. Abriendo resultados...");
      redirectWithCategory(route, position.coords);
    },
    () => {
      updateStatus(
        route === "walking"
          ? "No autorizaste ubicacion. No puedo calcular locales para ir a pie."
          : "No autorizaste ubicacion. Te mostrare locales generales por categoria."
      );

      if (route !== "walking") {
        redirectWithCategory(route, null);
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 7000,
      maximumAge: 0,
    }
  );
}

function setPanelState(button, panel, isOpen) {
  if (!button || !panel) return;

  panel.hidden = !isOpen;
  button.setAttribute("aria-expanded", String(isOpen));
  button.classList.toggle("is-active", isOpen);
}

function closeQuickPanels(exceptPanel = null) {
  if (exceptPanel !== menuPanel) {
    setPanelState(menuButton, menuPanel, false);
  }

  if (exceptPanel !== alertsPanel) {
    setPanelState(alertsButton, alertsPanel, false);
  }
}

function toggleQuickPanel(button, panel) {
  if (!button || !panel) return;

  const willOpen = panel.hidden;
  closeQuickPanels(panel);
  setPanelState(button, panel, willOpen);
}

function setupQuickPanels() {
  menuButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleQuickPanel(menuButton, menuPanel);
  });

  alertsButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleQuickPanel(alertsButton, alertsPanel);
  });

  [menuPanel, alertsPanel].forEach((panel) => {
    panel?.addEventListener("click", (event) => {
      if (event.target.closest("[data-open-ad-request]")) {
        closeQuickPanels();
      }
    });
  });

  document.addEventListener("click", (event) => {
    if (
      event.target.closest(".quick-panel") ||
      event.target.closest("#home-menu-btn") ||
      event.target.closest("#home-alerts-btn")
    ) {
      return;
    }

    closeQuickPanels();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeQuickPanels();
    }
  });
}

function setupSearch() {
  searchForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await redirectWithSearch(searchInput?.value);
  });
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
    if (!route) return;
    handleCategory(route);
  });
}

for (const link of suggestionLinks) {
  link.addEventListener("click", (event) => {
    const route = link.dataset.suggestionRoute;

    if (!route) return;

    event.preventDefault();
    handleCategory(route);
  });
}

setupQuickPanels();
setupSearch();
setupInstallFlow();
loadBurgerMasterPromotion();
loadCoverageZones();
showHomeCoverageHintIfOutside();
