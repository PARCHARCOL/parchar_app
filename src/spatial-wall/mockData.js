const examples = [
  [
    "planes",
    "Un café, una libreta y una tarde sin afán",
    "¿Qué lugar de tu barrio invita a sentarse y conversar? Me gustaría descubrir cafés pequeños con espacio para leer. Compartamos una recomendación y lo que la hace especial.",
    "Lina",
    "Medellín",
    25,
    "7d",
  ],
  [
    "planes",
    "Una caminata para mirar la ciudad distinto",
    "Propongo pensar una ruta corta, tranquila y accesible para un domingo. ¿Qué parque o sendero urbano recomendarías para ir acompañado? Confirmemos siempre el acceso y el clima antes de salir.",
    "Andrés",
    "Bello",
    50,
    "2h",
  ],
  [
    "planes",
    "Los mejores planes a veces son sencillos",
    "Un picnic, una conversación larga o volver a una biblioteca. Estoy haciendo una lista de planes que no dependan de gastar mucho. ¿Cuál sumarías y por qué?",
    "Sara",
    "Envigado",
    50,
    "permanent",
  ],
  [
    "arte",
    "Una película que se quedó contigo",
    "A veces una escena nos acompaña durante años. ¿Cuál fue esa película que te hizo mirar algo cotidiano de otra manera? Sin spoilers, podemos contar qué pregunta nos dejó.",
    "Tomás",
    "Sabaneta",
    75,
    "7d",
  ],
  [
    "arte",
    "La ciudad también se dibuja",
    "Este pequeño dibujo es un ejemplo de una publicación visual. Una esquina, una hoja o una ventana pueden convertirse en una historia. ¿Qué detalle de tu barrio dibujarías?",
    "Mar",
    "Medellín",
    25,
    "permanent",
  ],
  [
    "arte",
    "Escuchar antes de opinar",
    "Una obra puede gustarnos o incomodarnos. Me interesa conversar sobre lo que nos hace sentir, no decidir quién tiene la razón. ¿Qué exposición, canción o lectura te sorprendió últimamente?",
    "Nico",
    "Itagüí",
    100,
    "7d",
  ],
  [
    "conversaciones",
    "¿Qué hace que un lugar se sienta cercano?",
    "No siempre es la distancia. A veces conocemos mejor un sitio lejano que una esquina del propio barrio. ¿Influyen más las personas, los recuerdos o las posibilidades de llegar?",
    "Vale",
    "Medellín",
    75,
    "7d",
  ],
  [
    "conversaciones",
    "Recomendar con contexto",
    "Una recomendación resulta más útil cuando sabemos para quién funciona. En lugar de decir solamente «es buenísimo», podemos explicar si es tranquilo, accesible o adecuado para conversar. ¿Qué información echas de menos?",
    "Daniel",
    "Copacabana",
    100,
    "permanent",
  ],
  [
    "conversaciones",
    "Una pregunta para nuestros parques",
    "¿Qué pequeño cambio te ayudaría a disfrutar más de un espacio público? Pensemos en ideas concretas y respetuosas: sombra, señalización, acceso o actividades para distintas edades.",
    "Ana",
    "Bello",
    50,
    "7d",
  ],
  [
    "reflexiones",
    "Dejar un poco de espacio",
    "Hoy intenté salir sin llenar cada minuto de actividades. Descubrí que también hay planes que empiezan cuando dejamos de correr. Te dejo esta idea para cuando necesites una pausa.",
    "Julia",
    "Medellín",
    25,
    "2h",
  ],
  [
    "reflexiones",
    "Una buena conversación no siempre termina en acuerdo",
    "Me gustaría que este espacio nos permitiera preguntar sin competir. Escuchar una experiencia distinta también puede ser una forma de acercarnos. ¿Qué te ayuda a conversar cuando piensas diferente?",
    "Simón",
    "Caldas",
    75,
    "permanent",
  ],
  [
    "reflexiones",
    "Una joya para guardar",
    "Los lugares cambian, y nosotros también. Escribir lo que encontramos puede servir para compartir una recomendación, pero también para recordar cómo nos sentíamos cuando llegamos.",
    "Camila",
    "Girardota",
    100,
    "permanent",
  ],
];
export function makeExamples(period, now = Date.now()) {
  return examples
    .filter((row) => period !== "archive" || row[6] === "permanent")
    .map((row, index) => ({
      id: `example-${examples.indexOf(row)}`,
      topic: row[0],
      title: row[1],
      text: row[2],
      alias: row[3],
      city: row[4],
      depth: row[5],
      lifetime: row[6],
      expiresAt:
        row[6] === "permanent"
          ? null
          : new Date(
              now + (row[6] === "2h" ? 7200000 : 604800000),
            ).toISOString(),
      createdAt: new Date(now - index * 600000).toISOString(),
      contributions: (index % 4) * 3,
      background: "#ffffff",
      strokes:
        row[1] === "La ciudad también se dibuja"
          ? [
              {
                color: "#57aaff",
                width: 9,
                points: [
                  [0.2, 0.7],
                  [0.2, 0.4],
                  [0.5, 0.15],
                  [0.8, 0.4],
                  [0.8, 0.7],
                  [0.2, 0.7],
                ],
              },
              {
                color: "#f252ae",
                width: 6,
                points: [
                  [0.44, 0.7],
                  [0.44, 0.47],
                  [0.6, 0.47],
                  [0.6, 0.7],
                ],
              },
            ]
          : [],
    }));
}
export const exampleNotes = (post) =>
  post.id === "example-0"
    ? [
        {
          id: "example-note-1",
          alias: "Participante de ejemplo",
          text: "También es importante saber si el lugar permite conversar con calma.",
          anchor: {
            x: 0.4,
            y: 0.6,
            quote: "espacio para leer",
            start: post.text.indexOf("espacio para leer"),
          },
        },
      ]
    : [];
