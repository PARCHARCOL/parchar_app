# Agenda de eventos

El acceso publico es `/events.html`. La gestion esta en Admin > Eventos para
administradores y asesores. Las API de gestion requieren la sesion interna.

## Fuentes

- Agenda Colaborativa de Patrimonio Medellin: calendario mensual completo.
- Museo de Arte Moderno de Medellin: programacion propia.
- Teatro Pablo Tobon Uribe: todas las paginas de programacion disponibles.
- Teatro Metropolitano: programacion propia.
- Infolocal de Comfenalco Antioquia: listado paginado y referencias individuales,
  con municipio y departamento expresos.
- La Tiquetera: eventos y agendas de organizadores publicados en su dominio,
  con municipio confirmado. Se excluyen suscripciones y productos de viajes.

No existe un limite fijo de eventos por fuente. Las consultas usan concurrencia
acotada, tiempos de espera y seguimiento de paginacion para cuidar los servicios.
Cada fuente puede fallar de forma independiente sin descartar las demas. El
estado y resultado de cada consulta se conserva y se muestra en Admin.
Solo se importan fechas expresas. Un intervalo declarado por una fuente se
identifica como varias fechas y remite a los horarios de sus funciones; no se
inventa una recurrencia diaria. Los diez municipios admiten altas manuales.

## Alcance y permisos de contenidos

La agenda publica admite eventos abiertos al publico, incluidos los organizados
por privados. Los eventos marcados como invitacion cerrada quedan excluidos.
Para publicar manualmente un evento de organizador privado, el asesor debe
confirmar la revision de su referencia; se registra el usuario y la fecha
internamente. Esto no genera un sello ni certificacion de seguridad.

Las descripciones de importacion son propias y breves. Se conserva el nombre,
fecha, municipio y enlace original. Los enlaces de imagen de las fuentes quedan
visibles solo para el equipo: la API publica los elimina salvo que exista
`imageRightsConfirmed` y una referencia de licencia o permiso registrada.
La constancia y la identidad del revisor no se exponen en la API publica.
Estas comprobaciones no sustituyen la revision legal de las condiciones de cada
fuente ni acreditan por si mismas la autenticidad de una autorizacion.

## Actualizacion y moderacion

- Sincroniza al iniciar el servidor y cada seis horas mientras este activo.
- Admin permite solicitar otra sincronizacion.
- Las entradas automaticas usan nombre, fecha y municipio para evitar duplicados.
- Editar o cambiar la publicacion bloquea las futuras modificaciones automaticas
  de esa entrada, conservando las decisiones del equipo.
- Las consultas publicas filtran exactamente municipio, fecha y categoria.
- No se muestran entradas vencidas; cuando existe hora final se considera la
  zona horaria de Colombia. Las entradas automaticas sin actualizar durante
  72 horas dejan de mostrarse hasta una nueva consulta satisfactoria.
- Si una fuente falla, conserva los registros y muestra que no pudo actualizarse.
- La sincronizacion almacena un registro interno `__sync__`, excluido del catalogo.

## Persistencia y pruebas

La tabla `agenda_events` se crea de manera idempotente en la misma base existente
de Parchar, tanto PostgreSQL como SQLite de desarrollo. No necesita credenciales
adicionales ni migraciones destructivas.

Ejecutar `node --test tests/*.test.js`. Los casos de agenda cubren fecha de
Colombia, filtro municipal exacto, recurrencias, enlaces de fuente y duplicados.
