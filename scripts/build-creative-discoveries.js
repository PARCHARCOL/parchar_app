const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

async function build(source) {
  const metadata = await sharp(source).metadata();
  if (!metadata.hasAlpha) throw new Error("Discovery atlas requires a transparent background");
  const target = path.join(__dirname, "..", "public", "assets", "creative-world", "discoveries");
  await fs.mkdir(target, { recursive: true });
  for (let i = 0; i < 6; i++) {
    const left = Math.round(i % 3 * metadata.width / 3), top = Math.round(Math.floor(i / 3) * metadata.height / 2);
    await sharp(source).extract({ left, top, width: Math.round((i % 3 + 1) * metadata.width / 3) - left, height: Math.round((Math.floor(i / 3) + 1) * metadata.height / 2) - top }).resize(512, 512, { fit: "contain", background: "#00000000" }).webp({ quality: 90 }).toFile(path.join(target, `${i}.webp`));
  }
  console.log("Built six transparent discovery and landscape sprites");
}
if (require.main === module) build(process.argv[2]).catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { build };
