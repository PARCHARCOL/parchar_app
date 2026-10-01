const STANDARD_DESIGNS = [
  {
    id: "clasico",
    name: "Parchar clásico",
    note: "Morado de marca con los iconos actuales.",
    pageStart: "#2a1050",
    pageEnd: "#10071f",
    shellStart: "#48217d",
    shellEnd: "#1c0a39",
    accent: "#ffcc58",
    text: "#fff8ff",
    softText: "#d8c5ed",
    line: "#bb7aff",
    iconMode: "glass",
    cardMode: "open",
  },
  {
    id: "violeta",
    name: "Violeta moderno",
    note: "Morado profundo, lavanda y detalles dorados sobrios.",
    pageStart: "#241333",
    pageEnd: "#120c1d",
    shellStart: "#38214f",
    shellEnd: "#1b1229",
    accent: "#e5bd73",
    text: "#fbf7ff",
    softText: "#d1c2df",
    line: "#80629b",
    iconMode: "line",
    cardMode: "soft",
  },
  {
    id: "noche",
    name: "Noche premium",
    note: "Carbón oscuro con acentos champaña discretos.",
    pageStart: "#1a191c",
    pageEnd: "#0d0d10",
    shellStart: "#29272d",
    shellEnd: "#18171c",
    accent: "#dfc38c",
    text: "#faf8f4",
    softText: "#c8c2b8",
    line: "#716a5e",
    iconMode: "line",
    cardMode: "soft",
  },
  {
    id: "natural",
    name: "Natural",
    note: "Verde bosque y menta para una sensación tranquila.",
    pageStart: "#102b2b",
    pageEnd: "#081819",
    shellStart: "#1c4540",
    shellEnd: "#102623",
    accent: "#82d4b3",
    text: "#f5fbf7",
    softText: "#c1d9d0",
    line: "#5d9987",
    iconMode: "line",
    cardMode: "soft",
  },
  {
    id: "claro",
    name: "Claro lavanda",
    note: "Superficies claras, texto oscuro y acento violeta.",
    pageStart: "#efebf5",
    pageEnd: "#ded8e9",
    shellStart: "#ffffff",
    shellEnd: "#f4f0fa",
    accent: "#7042a0",
    text: "#241a31",
    softText: "#5d5268",
    line: "#c7b8d8",
    iconMode: "line",
    cardMode: "soft",
  },
  {
    id: "coral",
    name: "Coral urbano",
    note: "Grafito y coral vivo con iconos lineales claros.",
    pageStart: "#2b2024",
    pageEnd: "#141114",
    shellStart: "#463139",
    shellEnd: "#21181c",
    accent: "#ff927f",
    text: "#fff8f6",
    softText: "#e3c9c6",
    line: "#a76565",
    iconMode: "line",
    cardMode: "soft",
  },
];

const STANDARD_DESIGN_BY_ID = new Map(
  STANDARD_DESIGNS.map((design) => [design.id, design]),
);

function normalizeStandardDesignId(value) {
  return STANDARD_DESIGN_BY_ID.has(value) ? value : "clasico";
}

function getStandardDesign(value = "clasico") {
  return STANDARD_DESIGN_BY_ID.get(normalizeStandardDesignId(value));
}

module.exports = {
  STANDARD_DESIGNS,
  getStandardDesign,
  normalizeStandardDesignId,
};
