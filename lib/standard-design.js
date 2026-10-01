const STANDARD_DESIGNS = [
  {
    id: "actual",
    name: "Diseño actual de Parchar",
    note: "Conserva exactamente la apariencia, los colores y los iconos vigentes.",
    pageStart: "#2a1050",
    pageEnd: "#10071f",
    shellStart: "#48217d",
    shellEnd: "#1c0a39",
    accent: "#ffcc58",
    text: "#fff8ff",
    softText: "#d8c5ed",
    line: "#bb7aff",
    iconMode: "actual",
  },
  {
    id: "clasico-luminoso",
    name: "Parchar clásico",
    note: "Morado de marca, dorado y los iconos brillantes de Parchar.",
    pageStart: "#34105c",
    pageEnd: "#17072b",
    shellStart: "#552391",
    shellEnd: "#281047",
    accent: "#ffd052",
    text: "#fff9ff",
    softText: "#e5cff4",
    line: "#d277ff",
    iconMode: "glass",
  },
  {
    id: "violeta",
    name: "Violeta moderno",
    note: "Violeta luminoso, rosa y oro con iconos de vidrio brillante.",
    pageStart: "#31105a",
    pageEnd: "#180830",
    shellStart: "#54248b",
    shellEnd: "#2d1250",
    accent: "#ffca58",
    text: "#fbf7ff",
    softText: "#d1c2df",
    line: "#c06dff",
    iconMode: "glass",
  },
  {
    id: "noche",
    name: "Noche premium",
    note: "Azul noche, cian eléctrico e iconos con efecto luminoso.",
    pageStart: "#191b55",
    pageEnd: "#11102f",
    shellStart: "#292b79",
    shellEnd: "#1d1b54",
    accent: "#42dcff",
    text: "#f8f8ff",
    softText: "#c8d8ff",
    line: "#7778ff",
    iconMode: "glass",
  },
  {
    id: "natural",
    name: "Natural",
    note: "Verde tropical, menta y amarillo con botones relucientes.",
    pageStart: "#0b4b40",
    pageEnd: "#082a27",
    shellStart: "#12705c",
    shellEnd: "#104b43",
    accent: "#ffd44d",
    text: "#f5fbf7",
    softText: "#c1d9d0",
    line: "#56dfb0",
    iconMode: "glass",
  },
  {
    id: "claro",
    name: "Claro lavanda",
    note: "Lavanda clara, texto legible e iconos brillantes de color.",
    pageStart: "#fff0fb",
    pageEnd: "#eadfff",
    shellStart: "#ffffff",
    shellEnd: "#f8efff",
    accent: "#813dd2",
    text: "#28153c",
    softText: "#59456c",
    line: "#c294ee",
    iconMode: "glass",
  },
  {
    id: "coral",
    name: "Coral urbano",
    note: "Coral y fucsia intensos con botones de vidrio luminoso.",
    pageStart: "#471338",
    pageEnd: "#220e29",
    shellStart: "#82245e",
    shellEnd: "#44173d",
    accent: "#ff8c56",
    text: "#fff8fc",
    softText: "#f0cce5",
    line: "#f17bb3",
    iconMode: "glass",
  },
];

const STANDARD_DESIGN_BY_ID = new Map(
  STANDARD_DESIGNS.map((design) => [design.id, design]),
);

function normalizeStandardDesignId(value) {
  if (value === "clasico") return "actual";
  return STANDARD_DESIGN_BY_ID.has(value) ? value : "actual";
}

function getStandardDesign(value = "actual") {
  return STANDARD_DESIGN_BY_ID.get(normalizeStandardDesignId(value));
}

module.exports = {
  STANDARD_DESIGNS,
  getStandardDesign,
  normalizeStandardDesignId,
};
