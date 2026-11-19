const path = require("node:path"),
  fs = require("node:fs/promises"),
  zlib = require("node:zlib"),
  { execFileSync } = require("node:child_process"),
  { build } = require("esbuild");
(async () => {
  const root = path.resolve(__dirname, "..");
  await build({
    entryPoints: [path.join(root, "src/spatial-wall/main.jsx")],
    outfile: path.join(root, "public/spatial-wall.bundle.js"),
    bundle: true,
    minify: true,
    format: "esm",
    target: "es2022",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    legalComments: "eof",
  });
  execFileSync(
    process.execPath,
    [
      path.join(root, "node_modules/@tailwindcss/cli/dist/index.mjs"),
      "-i",
      path.join(root, "src/spatial-wall/styles.css"),
      "-o",
      path.join(root, "public/spatial-wall.css"),
      "--minify",
    ],
    { cwd: root, stdio: "inherit" },
  );
  const file = path.join(root, "public/spatial-wall.bundle.js"),
    data = await fs.readFile(file),
    br = zlib.brotliCompressSync(data, {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 },
    });
  await fs.writeFile(file + ".br", br);
  await fs.writeFile(file + ".gz", zlib.gzipSync(data, { level: 9 }));
  console.log(
    `Spatial wall: ${Math.round(data.length / 1024)} KB raw / ${Math.round(br.length / 1024)} KB Brotli`,
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
