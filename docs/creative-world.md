# Mundo del Muro creativo

El paisaje solo pertenece a creative.html. No modifica el logo ni el menu principal.
Panzoom conserva el control de arrastre, rueda, pellizco, zoom y centro.

## Recursos y extension

public/assets/creative-world/manifest.json define dimensiones, niveles de detalle,
zonas y seres. Los sectores ilustrados se repiten con reflexiones para prolongar
la exploracion en cualquier direccion; no son infinitos paisajes unicos generados
en tiempo real. Se pueden agregar nuevas ilustraciones y especies al catalogo.

El terreno usa cuatro niveles de detalle y teselas WebP de hasta 256 pixeles.
Solo se mantienen hasta 96 teselas y 40 seres cerca de la vista. Las criaturas
desaparecen al alejarse mucho para no saturar el panorama. Sus imagenes individuales
son independientes del terreno y conservan mas detalle al abrir la ficha.
Las publicaciones tienen su propia capa y no eliminan el paisaje al actualizarse.

scripts/build-creative-world.js genera los recursos desde tres PNG:
terreno, atlas de animales y atlas de seres elementales. Los dos atlas deben ser
transparentes con 3 columnas y 4 filas. Los originales locales de esta entrega
estan en .runtime/world-artwork/ dentro del proyecto en D:.

## Arte original

Se utilizo la herramienta integrada de generacion de imagenes. Prompts:
- Paisaje isometrico continuo, luminoso y tropical, con laguna central, bosque,
  cascadas, islas y jardin; sin texto, interfaz ni personajes de franquicias.
- Atlas transparente 3x4 de doce animales mitologicos originales, completos,
  luminosos y detallados, con margen por celda y sin escenario.
- Atlas transparente 3x4 de doce seres amables: hadas, elfo, duendes y guardianes
  elementales; completamente vestidos, sin armas y sin personajes de franquicias.

El selector de coleccion permite abrir las 24 fichas y localizar cada ser en el
plano. Las descripciones son ficcion, no informacion sobre lugares reales.
