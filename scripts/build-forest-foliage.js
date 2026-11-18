const path = require("node:path"), fs = require("node:fs/promises"), sharp = require("sharp");
async function main(source, materialSource) {
  const root = path.join(__dirname, "../public/assets/creative-world");
  const meta = await sharp(source).metadata();
  if (!meta.hasAlpha) throw new Error("Foliage atlas requires transparency");
  await fs.mkdir(root, { recursive: true });
  await sharp(source).resize(1152, 768, { fit: "fill" }).webp({ quality: 84 }).toFile(path.join(root, "forest-foliage-v1.webp"));
  const info = await fs.stat(path.join(root, "forest-foliage-v1.webp"));
  console.log(`Detailed six-species foliage atlas: ${Math.round(info.size / 1024)} KB`);
  if (!materialSource) throw new Error("Provide the water/bark/rock material atlas as the second argument");
  const surface = await sharp(materialSource).metadata();
  for (const [index, name, width, height] of [[0,"waterfall-flow-v1",256,512],[1,"forest-bark-v1",256,512],[2,"forest-rock-v1",384,384]]) {
    const left = Math.round(index * surface.width / 3), right = Math.round((index + 1) * surface.width / 3);
    await sharp(materialSource).extract({ left, top: 0, width: right - left, height: surface.height }).resize(width, height, { fit: "fill" }).webp({ quality: 84 }).toFile(path.join(root, `${name}.webp`));
  }
}
main(process.argv[2], process.argv[3]).catch((error) => { console.error(error); process.exitCode = 1; });
