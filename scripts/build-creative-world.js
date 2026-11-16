const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");
const fauna = [
  ["dragon", "Dragón esmeralda", "Un guardián de escamas luminosas que sobrevuela los senderos del bosque."],
  ["fenix", "Fénix del amanecer", "Sus plumas doradas iluminan las islas del mundo de Parchar."],
  ["unicornio", "Unicornio de luz", "Camina entre flores brillantes y claros tranquilos."],
  ["pegaso", "Pegaso de las nubes", "Sus alas blancas acompañan las corrientes suaves de aire."],
  ["grifo", "Grifo del valle", "Un majestuoso vigía de las rocas y cascadas."],
  ["serpiente-marina", "Serpiente de la laguna", "Recorre las aguas turquesas entre las islas."],
  ["zorro", "Zorro de nueve colas", "Un espíritu curioso de pelaje plateado y destellos rosados."],
  ["ciervo", "Ciervo del bosque", "Sus astas luminosas se confunden con las ramas del jardín."],
  ["kirin", "Kirin de cristal", "Una criatura serena de escamas azules y melena dorada."],
  ["tortuga", "Tortuga ancestral", "Transporta un pequeño jardín de musgo sobre su caparazón."],
  ["mariposa", "Mariposa iridiscente", "Sus alas reflejan los colores del paisaje fantástico."],
  ["koi", "Koi celestial", "Sus aletas dejan destellos suaves sobre el agua."],
];
const spirits = [
  ["hada-floral", "Hada de las flores", "Cuida las flores luminosas y los pequeños rincones del jardín."],
  ["elfo", "Elfo del sendero", "Un amable caminante de los bosques y puentes naturales."],
  ["duende", "Duende del jardín", "Un pequeño compañero alegre que se esconde entre las hojas."],
  ["agua", "Guardián del agua", "Un elemental sereno que acompaña las corrientes y cascadas."],
  ["tierra", "Guardiana de la tierra", "Entre musgo y flores protege los claros tranquilos."],
  ["aire", "Espíritu del aire", "Un ser ligero de telas y nubes que recorre las alturas."],
  ["fuego", "Guardián del fuego", "Su luz cálida ilumina sin quemar los caminos del mundo."],
  ["cristal", "Elemental de cristal", "Sus reflejos cambian de color al acercarse a la luz."],
  ["arbol", "Espíritu del árbol", "Un anciano amable de corteza y pequeñas hojas brillantes."],
  ["hada-luna", "Hada de la luna", "Sus alas violetas brillan sobre las lagunas nocturnas."],
  ["hongo", "Duende de las setas", "Un alegre habitante de los jardines más pequeños."],
  ["driade", "Dríade esmeralda", "Una guardiana de los árboles y de los senderos florales."],
];
async function build(terrain, animalAtlas, spiritAtlas) {
  const output = path.join(__dirname, "..", "public", "assets", "creative-world");
  await fs.mkdir(output, { recursive: true });
  const width = 1536, height = 1024, levels = [];
  await sharp(terrain).resize(width, height, { fit: "cover" }).webp({ quality: 90 }).toFile(path.join(output, "world-master.webp"));
  await sharp(terrain).resize(192, 128, { fit: "cover" }).webp({ quality: 72 }).toFile(path.join(output, "preview.webp"));
  for (let id = 0; id <= 3; id++) {
    const density = 2 ** (id - 3), w = width * density, h = height * density;
    const source = await sharp(terrain).resize(w, h, { fit: "cover" }).png().toBuffer();
    await fs.mkdir(path.join(output, String(id)), { recursive: true });
    for (let row = 0; row < Math.ceil(h / 256); row++) for (let col = 0; col < Math.ceil(w / 256); col++) await sharp(source).extract({ left: col * 256, top: row * 256, width: Math.min(256, w - col * 256), height: Math.min(256, h - row * 256) }).webp({ quality: 87 }).toFile(path.join(output, String(id), `${col}-${row}.webp`));
    levels.push({ id, density, width: w, height: h });
  }
  await fs.mkdir(path.join(output, "beings"), { recursive: true });
  const creatures = [];
  for (const [atlas, entries, offset] of [[animalAtlas, fauna, 0], [spiritAtlas, spirits, 12]]) {
    const metadata = await sharp(atlas).metadata();
    if (!metadata.hasAlpha) throw new Error("The creature atlas must have transparency");
    for (let i = 0; i < entries.length; i++) {
      const [id, name, description] = entries[i], left = Math.round(i % 3 * metadata.width / 3), top = Math.round(Math.floor(i / 3) * metadata.height / 4);
      await sharp(atlas).extract({ left, top, width: Math.round((i % 3 + 1) * metadata.width / 3) - left, height: Math.round((Math.floor(i / 3) + 1) * metadata.height / 4) - top }).resize(512, 512, { fit: "contain", background: "#00000000" }).webp({ quality: 90 }).toFile(path.join(output, "beings", `${id}.webp`));
      const n = offset + i;
      creatures.push({ id, name, description, x: 0.13 + n % 6 * 0.145, y: 0.18 + Math.floor(n / 6) * 0.21, size: n < 12 ? 155 : 120 });
    }
  }
  const manifest = { version: 1, width, height, tileSize: 256, levels, creatures, zones: [{ id: "laguna", name: "Laguna", x: 0, y: 0 }, { id: "bosque", name: "Bosque", x: -width * 0.3, y: -height * 0.28 }, { id: "cascadas", name: "Cascadas", x: width * 0.3, y: -height * 0.28 }, { id: "islas", name: "Islas", x: width * 0.28, y: height * 0.25 }, { id: "jardin", name: "Jardín", x: -width * 0.3, y: height * 0.25 }] };
  await fs.writeFile(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Built ${levels.length} detail levels, ${creatures.length} beings in ${output}`);
}
if (require.main === module) build(...process.argv.slice(2)).catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { build };
