# Muro espacial de Parchar

El acceso existente `/creative.html` ahora monta un modulo React 2D. El resto de
la aplicacion sigue con su arquitectura actual; no se descarga Three.js ni los
recursos del antiguo bosque al abrir este muro.

## Desarrollo

Desde `D:\proyectos\parchar_app`:

```powershell
npm install
npm run build:wall
npm test
npm start
```

Se conservan versionados el JS, CSS y las variantes precomprimidas para que el
servidor de produccion no necesite compilar. Tras modificar componentes, ejecutar
`build:wall` y actualizar la version de assets/cache PWA si cambia la entrega.

## Ediciones y privacidad

- Cuatro islas, con posiciones estables al filtrar. Cada edicion contiene como
  maximo 12 nodos por isla (48 en total); no hay paginacion infinita.
- Manana: 06:00 a 18:00. Noche: 18:00 a 06:00, en America/Bogota. Se muestra el
  ultimo periodo iniciado. Joyas muestra publicaciones permanentes, incluidas
  las creaciones anteriores sin metadatos espaciales. No se eliminan datos viejos.
- Cercania geografica: municipio elegido, area metropolitana o toda la comunidad.
  No existe una red de amistades en Parchar, por lo que no se simula un circulo intimo.
- Profundidad filtra por el nivel declarado al crear el nodo. El tamano aumenta
  de forma acotada segun participantes distintos con notas aprobadas; no por likes.
- Caducidad de 2 horas, 7 dias o permanente, calculada por el servidor desde el
  envio. La caducidad de una nota no puede superar la de su publicacion principal.
- Las nuevas tablas son aditivas. Nodos y notas conservan la autenticacion,
  limites y moderacion existentes. No se aprueba automaticamente sin el analisis
  configurado o la decision de un asesor.
- Los agradecimientos son privados y se consultan solo como totales por el autor;
  no se publican identidades de remitentes. La capsula pertenece al usuario autenticado.
- Los fragmentos anclados se contrastan con el texto original en el servidor.
- El progreso cuenta nodos abiertos, no nodos mostrados, y se guarda localmente
  por edicion. Los filtros no reducen su denominador.

## Ejemplo y datos reales

`/creative.html?example=1` activa 12 publicaciones ficticias identificadas con
la etiqueta **Ejemplo**. Las creaciones, notas y acciones de esta edicion se
guardan exclusivamente en el dispositivo. No se insertan en la base de datos.
El boton de matraz alterna entre el ejemplo y la comunidad real.

Una primera edicion vacia muestra automaticamente el ejemplo con un aviso.
Las publicaciones existentes de la comunidad se encuentran en Joyas, o en su
edicion diaria cuando corresponda. El panel de asesores sigue en
`/creative-admin.html`.

## Comprobaciones

Las pruebas incluyen normalizacion, moderacion, notas contextuales, privacidad,
caducidad, capacidad finita, consultas publicas concurrentes, posiciones sin
solapamiento y equivalencia de archivos comprimidos. Las verificaciones visuales
deben cubrir telefono, tableta y PC, incluidos gestos, modo oscuro, dialogos y
la separacion respecto al banner fijo. No equivalen a una prueba de carga de
miles de usuarios ni a una validacion en un telefono fisico.
