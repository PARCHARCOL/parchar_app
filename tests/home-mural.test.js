const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { getStandardDesign, normalizeStandardDesignId } = require("../lib/standard-design");

test("mural is an optional design and classic remains the default", () => {
  assert.equal(getStandardDesign().id, "actual");
  assert.equal(normalizeStandardDesignId("clasico"), "actual");
  assert.equal(getStandardDesign("mural").layout, "mural");
  assert.equal(normalizeStandardDesignId("unknown"), "actual");
});

test("logo header uses its own abstract background, not category photography", () => {
  const css = fs.readFileSync(require.resolve("../public/styles.css"), "utf8");
  const headerRule = css.match(/html\[data-standard-design="mural"\]\[data-standard-design\] \.home-body \.top-strip \{([^}]+)\}/)[1];
  assert.match(headerRule, /mural-logo-abstract\.webp/);
  assert.doesNotMatch(headerRule, /home-scene-|event-scene-/);
});

test("mural keeps one header logo and one fixed player, including upgrades from the old mural", () => {
  const node = () => ({
    children: [], parentElement: null,
    append(child) { this.insertBefore(child, null); },
    insertBefore(child, before) {
      if (child.parentElement) child.parentElement.children = child.parentElement.children.filter((item) => item !== child);
      const index = this.children.indexOf(before);
      this.children.splice(index < 0 ? this.children.length : index, 0, child);
      child.parentElement = this;
    },
  });
  const body = node(), header = node(), logo = node(), logoWindow = node(), grid = node(), ad = node(), alerts = node(), restaurant = node();
  header.append(logo); header.append(alerts); grid.append(logoWindow); grid.append(restaurant); body.append(ad);
  grid.querySelector = () => restaurant;
  const elements = { "#home-logo-window": logoWindow, ".home-body .brand-size-row": logo, ".home-body .top-strip": header, "#home-alerts-btn": alerts, ".home-body .ad-banner": ad, ".home-body .button-grid": grid };
  const document = { body, documentElement: { dataset: {}, style: { setProperty() {} } }, querySelector: (selector) => elements[selector] };
  const source = fs.readFileSync(require.resolve("../public/theme.js"), "utf8");
  const context = vm.createContext({ document });
  vm.runInContext(source.slice(source.indexOf("function applyStandardDesign"), source.indexOf("\ntry {")), context);
  logoWindow.append(logo);
  grid.append(ad);
  context.applyStandardDesign(getStandardDesign("mural"));
  context.applyStandardDesign(getStandardDesign("mural"));
  assert.equal(logo.parentElement, header);
  assert.equal(logoWindow.children.length, 0);
  assert.equal(ad.parentElement, body);
  assert.equal(body.children.filter((item) => item === ad).length, 1);
  context.applyStandardDesign(getStandardDesign("actual"));
  assert.equal(logo.parentElement, header);
  assert.equal(ad.parentElement, body);
  assert.equal(logoWindow.hidden, true);
});
