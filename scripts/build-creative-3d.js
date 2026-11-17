const path = require("node:path");
const fs = require("node:fs/promises");
const { build } = require("esbuild");
const zlib = require("node:zlib");
async function main() {
  const root = path.join(__dirname, "..");
  await build({ entryPoints: [path.join(root, "src/creative-world-3d.js")], outfile: path.join(root, "public/creative-world-3d.module.js"), bundle: true, minify: true, format: "esm", target: "es2022", legalComments: "eof" });
  await fs.copyFile(path.join(root, "node_modules/three/LICENSE"), path.join(root, "public/vendor/three-LICENSE.txt"));
  const stats = await fs.stat(path.join(root, "public/creative-world-3d.module.js"));
  const source = await fs.readFile(path.join(root, "public/creative-world-3d.module.js"));
  const brotli = zlib.brotliCompressSync(source, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } });
  await fs.writeFile(path.join(root, "public/creative-world-3d.module.js.br"), brotli);
  await fs.writeFile(path.join(root, "public/creative-world-3d.module.js.gz"), zlib.gzipSync(source, { level: 9 }));
  console.log(`Lazy 3D bundle: ${(stats.size / 1024).toFixed(0)} KB; only used inside the wall`);
  console.log(`Brotli transfer: ${(brotli.length / 1024).toFixed(0)} KB; compressed during build, not per request`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
