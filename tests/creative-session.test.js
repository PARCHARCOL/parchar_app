const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("wall refreshes login changes and only disables publishing while sending", () => {
  const source = fs.readFileSync(require.resolve("../public/creative.js"), "utf8");
  const controls = { "#wall-auth-note": {}, "#wall-publish": {} };
  let saved = "{}";
  const context = vm.createContext({ localStorage: { getItem: () => saved }, $: (selector) => controls[selector] });
  vm.runInContext("let session = {}, submitting = false;" + source.slice(source.indexOf("function syncSession()"), source.indexOf("  syncSession();")), context);
  context.syncSession(); assert.equal(controls["#wall-publish"].disabled, false); assert.equal(controls["#wall-auth-note"].hidden, false);
  saved = JSON.stringify({ token: "new-session", client: { fullName: "Prueba" } }); context.syncSession();
  assert.equal(controls["#wall-auth-note"].hidden, true);
  vm.runInContext("submitting = true", context); context.syncSession(); assert.equal(controls["#wall-publish"].disabled, true);
  vm.runInContext("submitting = false", context); saved = "{}"; context.syncSession(); assert.equal(controls["#wall-auth-note"].hidden, false); assert.equal(controls["#wall-publish"].disabled, false);
  saved = "not-json"; assert.doesNotThrow(() => context.syncSession());
});

test("client login return is restricted to the creative wall", () => {
  const source = fs.readFileSync(require.resolve("../public/clients.js"), "utf8");
  const fn = source.slice(source.indexOf("function returnToCreativeWall()"), source.indexOf("loginForm?.addEventListener"));
  let target;
  const location = { search: "?next=https://evil.example", replace: (value) => { target = value; } };
  const context = vm.createContext({ location, URLSearchParams }); vm.runInContext(fn, context);
  assert.equal(context.returnToCreativeWall(), false); assert.equal(target, undefined);
  location.search = "?next=creative";
  assert.equal(context.returnToCreativeWall(), true); assert.equal(target, "/creative.html?editor=1");
});
