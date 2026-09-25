const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_SEASONAL_SETTINGS,
  MONTHS,
  SEASONAL_THEMES,
  normalizeSeasonalSettings,
  resolveSeasonalTheme,
} = require("../lib/seasonal-design");

test("ships a themed, editable preset for every Colombian calendar month", () => {
  assert.equal(MONTHS.length, 12);
  assert.equal(SEASONAL_THEMES.length, 12);
  assert.equal(new Set(SEASONAL_THEMES.map((theme) => theme.id)).size, 12);
  assert.deepEqual(Object.keys(DEFAULT_SEASONAL_SETTINGS.monthThemes), Array.from({ length: 12 }, (_, index) => String(index + 1)));
});

test("automatic mode selects the current month in Bogota time", () => {
  const settings = normalizeSeasonalSettings({});
  const theme = resolveSeasonalTheme(settings, new Date("2026-01-01T02:00:00.000Z"));
  assert.equal(theme.month, 12);
  assert.equal(theme.id, "navidad");
});

test("manual and disabled modes override the monthly calendar", () => {
  assert.equal(resolveSeasonalTheme({ mode: "manual", manualThemeId: "halloween" }, new Date("2026-05-15T17:00:00Z")).id, "halloween");
  assert.equal(resolveSeasonalTheme({ mode: "off" }, new Date("2026-10-15T17:00:00Z")), null);
  assert.equal(resolveSeasonalTheme({ enabled: false }, new Date("2026-10-15T17:00:00Z")), null);
});

test("disabled month returns the normal Parchar appearance", () => {
  const settings = normalizeSeasonalSettings({ monthThemes: { 9: { enabled: false, themeId: "amistad" } } });
  assert.equal(resolveSeasonalTheme(settings, new Date("2026-09-15T17:00:00Z")), null);
});

test("invalid and unknown settings are safely replaced with allowed defaults", () => {
  const settings = normalizeSeasonalSettings({
    mode: "javascript:alert(1)",
    manualThemeId: "not-a-theme",
    monthThemes: { 10: { enabled: true, themeId: "not-a-theme" }, 13: { enabled: true, themeId: "halloween" } },
  });
  assert.equal(settings.mode, "automatic");
  assert.equal(settings.manualThemeId, "navidad");
  assert.deepEqual(settings.monthThemes["10"], { enabled: true, themeId: "halloween" });
  assert.equal(Object.keys(settings.monthThemes).length, 12);
});
