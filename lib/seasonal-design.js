const SEASONAL_THEMES = [
  { id: "reyes", name: "Reyes y vacaciones", note: "Viajes y regreso a actividades", accent: "#e5c77a", surface: "#443523", deep: "#1b1527", border: "#b79a59" },
  { id: "carnaval", name: "Carnavales", note: "Fiestas y escapadas", accent: "#f09ab7", surface: "#48223c", deep: "#1e102c", border: "#bb6b93" },
  { id: "mujer", name: "Mes de la mujer", note: "Experiencias y actividades", accent: "#e79ab9", surface: "#44223c", deep: "#1c1029", border: "#b66f94" },
  { id: "semana-santa", name: "Semana Santa y turismo", note: "Tema ajustable si la fecha cae en marzo", accent: "#94d4c5", surface: "#203d3a", deep: "#111d27", border: "#609a8b" },
  { id: "madres", name: "Mes de las madres", note: "Planes para compartir", accent: "#f0a1a2", surface: "#48262f", deep: "#21121f", border: "#bc7479" },
  { id: "padres", name: "Padres y vacaciones", note: "Celebraciones y temporada escolar", accent: "#91c9dc", surface: "#203b4a", deep: "#111a2a", border: "#5f98ac" },
  { id: "vacaciones", name: "Vacaciones de mitad de año", note: "Salidas, pueblos y naturaleza", accent: "#8ed7d0", surface: "#1e4144", deep: "#101c2c", border: "#5b9b97" },
  { id: "flores", name: "Feria de las Flores", note: "Medellín y cultura local", accent: "#e9a5bf", surface: "#3e2947", deep: "#1b142b", border: "#ae789b" },
  { id: "amistad", name: "Amor y Amistad", note: "Celebración comercial de septiembre", accent: "#f09aa9", surface: "#492333", deep: "#201020", border: "#b9687f" },
  { id: "halloween", name: "Halloween", note: "Planes y eventos de octubre", accent: "#f3ae75", surface: "#432b24", deep: "#1d1322", border: "#b77a4f" },
  { id: "comercio", name: "Compra local y Black Friday", note: "Temporada comercial de noviembre", accent: "#dfc47a", surface: "#373326", deep: "#191722", border: "#a89153" },
  { id: "navidad", name: "Navidad y fin de año", note: "Celebraciones de diciembre", accent: "#e5c77a", surface: "#274136", deep: "#111d25", border: "#a68a52" },
];

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DEFAULT_SEASONAL_SETTINGS = Object.freeze({
  enabled: true,
  mode: "automatic",
  manualThemeId: "navidad",
  monthThemes: Object.freeze(Object.fromEntries(
    SEASONAL_THEMES.map((theme, index) => [String(index + 1), Object.freeze({ enabled: true, themeId: theme.id })]),
  )),
});

const THEME_BY_ID = new Map(SEASONAL_THEMES.map((theme) => [theme.id, theme]));

function normalizeSeasonalSettings(input = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const monthThemes = {};

  for (let month = 1; month <= 12; month += 1) {
    const key = String(month);
    const candidate = source.monthThemes?.[key];
    const fallback = DEFAULT_SEASONAL_SETTINGS.monthThemes[key];
    const themeId = THEME_BY_ID.has(candidate?.themeId) ? candidate.themeId : fallback.themeId;
    monthThemes[key] = {
      enabled: typeof candidate?.enabled === "boolean" ? candidate.enabled : fallback.enabled,
      themeId,
    };
  }

  return {
    enabled: source.enabled !== false,
    mode: ["automatic", "manual", "off"].includes(source.mode) ? source.mode : "automatic",
    manualThemeId: THEME_BY_ID.has(source.manualThemeId) ? source.manualThemeId : DEFAULT_SEASONAL_SETTINGS.manualThemeId,
    monthThemes,
  };
}

function getColombiaMonth(date = new Date()) {
  return Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    month: "numeric",
  }).format(date));
}

function resolveSeasonalTheme(settings, date = new Date()) {
  const normalized = normalizeSeasonalSettings(settings);
  if (!normalized.enabled || normalized.mode === "off") return null;

  const themeId = normalized.mode === "manual"
    ? normalized.manualThemeId
    : normalized.monthThemes[String(getColombiaMonth(date))]?.enabled
      ? normalized.monthThemes[String(getColombiaMonth(date))].themeId
      : null;

  const theme = themeId ? THEME_BY_ID.get(themeId) : null;
  return theme ? { ...theme, month: normalized.mode === "manual" ? null : getColombiaMonth(date) } : null;
}

function publicSeasonalDesign(settings, date = new Date()) {
  return {
    theme: resolveSeasonalTheme(settings, date),
  };
}

module.exports = {
  DEFAULT_SEASONAL_SETTINGS,
  MONTHS,
  SEASONAL_THEMES,
  normalizeSeasonalSettings,
  publicSeasonalDesign,
  resolveSeasonalTheme,
};
