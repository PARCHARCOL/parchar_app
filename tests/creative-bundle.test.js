const test = require("node:test"), assert = require("node:assert/strict"), http = require("node:http"), fs = require("node:fs"), path = require("node:path"), zlib = require("node:zlib");
const { preferredEncoding, sendCreativeBundle } = require("../lib/creative-bundle");
test("static world bundle honors encoding preferences and explicit exclusions", () => {
  assert.equal(preferredEncoding("gzip, br"), "br");
  assert.equal(preferredEncoding("gzip;q=1, br;q=0.4"), "gzip");
  assert.equal(preferredEncoding("br;q=0,gzip;q=0"), undefined);
  assert.equal(preferredEncoding("*;q=1, br;q=0"), "gzip");
  assert.equal(preferredEncoding(""), undefined);
});
test("precompressed script is valid and repeated requests can return 304", async (t) => {
  const target = path.resolve(__dirname, "../public/creative-world-3d.module.js");
  const original = fs.readFileSync(target);
  assert.deepEqual(zlib.brotliDecompressSync(fs.readFileSync(target + ".br")), original);
  assert.deepEqual(zlib.gunzipSync(fs.readFileSync(target + ".gz")), original);
  assert.ok(fs.statSync(target + ".br").size < original.length / 3);
  const server = http.createServer((req, res) => sendCreativeBundle(req, res, target));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)); t.after(() => server.close());
  const read = (headers) => new Promise((resolve, reject) => { http.get({ hostname: "127.0.0.1", port: server.address().port, headers }, (res) => { const data = []; res.on("data", (part) => data.push(part)); res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(data) })); }).on("error", reject); });
  const first = await read({ "Accept-Encoding": "br, gzip" });
  assert.equal(first.status, 200); assert.equal(first.headers["content-encoding"], "br"); assert.equal(first.headers.vary, "Accept-Encoding"); assert.deepEqual(zlib.brotliDecompressSync(first.body), original);
  const repeat = await read({ "Accept-Encoding": "br", "If-None-Match": first.headers.etag }); assert.equal(repeat.status, 304); assert.equal(repeat.body.length, 0);
  const plain = await read({ "Accept-Encoding": "br;q=0,gzip;q=0" }); assert.equal(plain.headers["content-encoding"], undefined); assert.deepEqual(plain.body, original);
});
