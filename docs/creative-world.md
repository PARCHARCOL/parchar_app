# Mundo del Muro creativo

El paisaje solo pertenece a creative.html. No modifica el logo ni el menu principal.
Panzoom conserva el control de arrastre, rueda, pellizco, zoom y centro.

## Recursos y extension

public/assets/creative-world/manifest.json define dimensiones, niveles de detalle,
zonas y seres. La ilustracion original aparece una sola vez en el centro.
creative-terrain.js extiende el terreno mediante ruido continuo determinista:
cada coordenada conserva su relieve, costas, rios y bioma en cualquier visita.
No refleja ni repite el mapa original. Se puede explorar mas alla de 64000 unidades
sin descargar una imagen gigante. Esto no significa infinitas ilustraciones
artesanales: arboles, cascadas, setas y especies reutilizan un catalogo de sprites.

El terreno usa cuatro niveles de detalle y teselas WebP de hasta 256 pixeles.
Solo se mantienen hasta 96 teselas y 40 seres cerca de la vista. Las criaturas
desaparecen al alejarse mucho para no saturar el panorama. Sus imagenes individuales
son independientes del terreno y conservan mas detalle al abrir la ficha.
Las publicaciones tienen su propia capa y no eliminan el paisaje al actualizarse.
Fuera del centro se conservan hasta 96 teselas de terreno y 100 elementos de
vegetacion. Se pinta una tesela por fotograma para repartir el trabajo. Los objetos
pequenos se revelan a partir de 110% de zoom; no se generan por llamadas a IA.

## Mensajes como hallazgos

Solo las publicaciones que devuelve la API publica se muestran en el mundo.
Su identificador decide de forma estable entre piedra, flor y caracola. El objeto
conserva la posicion de su publicacion; no se crean mensajes falsos ni se cambia
la moderacion. A partir de 110% se ve un fragmento y al tocar el objeto se abre el
dialogo existente con el mensaje completo, dibujo, apoyos y reporte. Los trazos se
proyectan sobre el objeto sin el fondo rectangular del editor. Los textos usan
textContent, nunca HTML proporcionado por usuarios. Los ultimos 500 hallazgos
abiertos se recuerdan solo en el dispositivo y su brillo cambia, sin premios ni
contadores publicos. Lista y Mis creaciones mantienen su lectura convencional.

scripts/build-creative-world.js genera los recursos desde tres PNG:
terreno, atlas de animales y atlas de seres elementales. Los dos atlas deben ser
transparentes con 3 columnas y 4 filas. Los originales locales de esta entrega
estan en .runtime/world-artwork/ dentro del proyecto en D:.
build-creative-discoveries.js genera seis WebP transparentes desde el atlas 3x2
.runtime/world-artwork/discoveries.png: tres portadores y tres elementos de paisaje.

## Arte original

Se utilizo la herramienta integrada de generacion de imagenes. Prompts:
- Paisaje isometrico continuo, luminoso y tropical, con laguna central, bosque,
  cascadas, islas y jardin; sin texto, interfaz ni personajes de franquicias.
- Atlas transparente 3x4 de doce animales mitologicos originales, completos,
  luminosos y detallados, con margen por celda y sin escenario.
- Atlas transparente 3x4 de doce seres amables: hadas, elfo, duendes y guardianes
  elementales; completamente vestidos, sin armas y sin personajes de franquicias.
- Atlas transparente 3x2 original, isometrico, detallado y bioluminiscente: piedra
  de amatista cubierta de musgo, flor de loto turquesa, caracola dorada, arboles de
  hojas violetas, cascada con helechos y setas azules y rosas; sin texto ni marcos.

El selector de coleccion permite abrir las 24 fichas y localizar cada ser en el
plano. Las descripciones son ficcion, no informacion sobre lugares reales.
