# Mundo del Muro creativo

## Escena 3D actual

creative.html carga creative-3d.js y creative-space.js. El motor Three.js 0.187.0
se importa bajo demanda unicamente dentro del muro. No se importa en la portada
ni se incluye el paquete 3D en la precarga obligatoria del service worker.
scripts/build-creative-3d.js compila src/creative-world-3d.js con esbuild.
El paquete resultante local es public/creative-world-3d.module.js; se conserva
la licencia de Three en public/vendor/three-LICENSE.txt.
El build genera variantes Brotli y gzip. creative-bundle.js las sirve ya
comprimidas, con Vary/ETag y revalidacion, sin comprimir por cada visitante.
La version de esta entrega transfiere unos 133 KB de JavaScript con Brotli,
en lugar de unos 580 KB sin comprimir, ademas de las imagenes cercanas.

El escenario tiene terreno, vegetacion y letreros con volumen. Los 24 personajes
siguen siendo ilustraciones transparentes dentro del espacio 3D, no modelos
animados. No se presenta este recurso como un mundo AAA ni como infinitos
modelos o ilustraciones artesanales. La rueda y los botones desplazan la camara;
el pellizco se transforma en avance/retroceso, no en agrandar una imagen hasta
un tope. OrbitControls administra arrastre, giro, pellizco e inercia.

El espacio se genera por coordenadas y cambia de origen local despues de 10000
unidades para limitar errores de precision. La generacion no utiliza IA ni
consultas de servidor. Se mantienen 25 sectores (9 en detalle reducido), hasta
320 plantas, 10 seres y 10 letreros cercanos (6 en detalle reducido). El resto
de las publicaciones permanece en la API y se descubre conforme cambia la zona.
Los letreros reservan claros y los seres se separan al menos 440 unidades.

No hay sombras, postprocesamiento, fisica remota ni simulacion multijugador.
La iluminacion se hornea en los vertices y la vegetacion se dibuja por instancias.
El tamano de dibujo se limita a 900000 pixeles, o 260000 en detalle reducido.
La escena deja de dibujarse en reposo, al cambiar de vista, abrir un dialogo o
ocultar la pestana. Libera geometrias y texturas al abandonar sectores y al fallar.
No se admite el contexto 3D cuando hay ahorro de datos o menos de 2 GB declarados
por el navegador; en los demas casos se degrada ante lentitud sostenida y se
desactiva si no alcanza el umbral. Sin WebGL2 o ante perdida del contexto sigue
disponible Vista ligera. Esto no garantiza 60 FPS en todos los celulares.
Cuando se desactiva durante el uso, se recuerda durante siete dias en ese
dispositivo para no repetir la carga pesada. Reintentar 3D permite probarlo de
nuevo explicitamente. Los saltos del selector a zonas muy lejanas no recorren
ni construyen todos los sectores intermedios.

## Concurrencia y publicaciones

Las consultas del cliente se agrupan en sectores estables y solo se solicitan
tras estabilizarse el movimiento. Se abortan solicitudes anteriores y se conserva
una cache de 20 segundos, 8 zonas pequenas, con un maximo nominal de 2 MB.
Actualizar limpia esa cache. No hay peticiones por fotograma.

creative-read-cache.js agrupa lecturas publicas concurrentes de una misma zona
en una promesa compartida. Su TTL es 3 segundos; se limita a 32 entradas y 4 MB
por proceso y se invalida tras acciones de escritura/moderacion. Mis creaciones,
moderacion y autenticacion nunca usan esta cache publica. La moderacion automatica
externa puede tardar hasta ese TTL en aparecer en las lecturas publicas.
Se mantienen indices por estado/coordenadas y limites de 60 creaciones por consulta.

Los ensayos incluyen 1000 lecturas simultaneas del mismo sector que realizan un
solo SELECT. Es una prueba local de coalescencia, no una certificacion de 1000
usuarios de Render ni de distintas zonas simultaneas. Para ese objetivo se debe
medir el servicio y la base reales, su plan, CPU, memoria, red y distribucion de
trafico. Si hay varias instancias, cada una tiene su propia cache de 4 MB.
No se cambia el proceso de aprobacion ni se publican los ejemplos de QA.

## Recursos del renderer 2D anterior

Lo siguiente documenta el renderer anterior, conservado como codigo de referencia
y recursos reutilizables. creative.html ya no lo ejecuta ni repinta sus teselas.

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
