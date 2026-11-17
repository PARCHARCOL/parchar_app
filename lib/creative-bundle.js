const fs = require("node:fs"), crypto = require("node:crypto");
function preferredEncoding(header = "") {
  const choices = new Map();
  for (const part of String(header).split(",")) {
    const [name, ...params] = part.trim().toLowerCase().split(";");
    const q = params.find((value) => value.trim().startsWith("q="));
    const quality = q ? Number(q.trim().slice(2)) : 1;
    choices.set(name, Number.isFinite(quality) && quality >= 0 && quality <= 1 ? quality : 0);
  }
  return ["br", "gzip"].map((name) => ({ name, q: choices.get(name) ?? choices.get("*") ?? 0 })).filter((item) => item.q > 0).sort((a, b) => b.q - a.q)[0]?.name;
}
const tags = new Map();
function sendCreativeBundle(req, res, file) {
  let encoding = preferredEncoding(req.headers["accept-encoding"]);
  let target = file + (encoding === "br" ? ".br" : encoding === "gzip" ? ".gz" : "");
  if (!fs.existsSync(target)) { target = file; encoding = undefined; }
  if (!fs.existsSync(target)) { res.writeHead(404); res.end(); return; }
  if (!tags.has(target)) tags.set(target, `"${crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex")}"`);
  const headers = { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "public, max-age=0, must-revalidate", Vary: "Accept-Encoding", ETag: tags.get(target) };
  if (encoding) headers["Content-Encoding"] = encoding;
  if (String(req.headers["if-none-match"] || "").split(",").map((item) => item.trim()).includes(headers.ETag)) { res.writeHead(304, headers); res.end(); return; }
  headers["Content-Length"] = fs.statSync(target).size;
  res.writeHead(200, headers); fs.createReadStream(target).pipe(res);
}
module.exports = { preferredEncoding, sendCreativeBundle };
