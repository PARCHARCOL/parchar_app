const test = require("node:test"), assert = require("node:assert/strict");
const { createCreativeReadCache } = require("../lib/creative-read-cache");

test("1000 simultaneous reads of one public zone share one loader", async () => {
  const cache = createCreativeReadCache(); let calls = 0;
  const load = async () => { calls++; await new Promise((resolve) => setTimeout(resolve, 10)); return { items: [{ id: "public-only" }] }; };
  const replies = await Promise.all(Array.from({ length: 1000 }, () => cache.read("same-zone", load)));
  assert.equal(calls, 1); assert.ok(replies.every((value) => value.items[0].id === "public-only"));
});
test("public cache expires, bounds entries and releases all bytes on invalidation", async () => {
  let now = 1, calls = 0;
  const cache = createCreativeReadCache({ now: () => now, ttl: 100, maxEntries: 2, maxBytes: 150 });
  const load = async () => ({ n: ++calls, text: "a".repeat(40) });
  await cache.read("a", load); await cache.read("a", load); assert.equal(calls, 1);
  now += 101; await cache.read("a", load); assert.equal(calls, 2);
  for (const key of ["b", "c", "d"]) await cache.read(key, load);
  assert.ok(cache.size <= 2); assert.ok(cache.bytes <= 150);
  cache.invalidate(); assert.equal(cache.size, 0); assert.equal(cache.bytes, 0);
});
test("errors and oversized responses are not retained", async () => {
  const cache = createCreativeReadCache({ maxBytes: 20 });
  await assert.rejects(cache.read("error", async () => { throw new Error("offline"); })); assert.equal(cache.size, 0);
  await cache.read("large", async () => ({ text: "a".repeat(1000) })); assert.equal(cache.size, 0); assert.equal(cache.bytes, 0);
});
test("invalidation prevents an older in-flight read from filling the new cache", async () => {
  const cache = createCreativeReadCache(); let finish;
  const read = cache.read("zone", () => new Promise((resolve) => { finish = resolve; }));
  await Promise.resolve(); cache.invalidate(); finish({ items: ["old"] }); await read;
  const current = await cache.read("zone", async () => ({ items: ["new"] }));
  assert.deepEqual(current.items, ["new"]);
});
