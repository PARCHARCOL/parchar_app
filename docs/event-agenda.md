# Agenda de eventos

El acceso publico es `/events.html`. La gestion esta en Admin > Eventos para
administradores y asesores. Las API de gestion requieren la sesion interna.

## Fuente inicial

Agenda Colaborativa de Patrimonio Medellin:
https://agenda.patrimoniomedellin.gov.co/agenda-colaborativa/

El conector importa las fechas explicitas del calendario mensual completo y
complementa los eventos destacados con sus referencias individuales.
Solo importa fechas explicitas; no interpreta un rango de fechas como una
recurrencia diaria. Las imagenes se referencian desde la fuente, sin copiar
archivos al almacenamiento de Parchar. Cada ficha conserva su referencia.
Esta fuente inicial no proporciona cobertura exhaustiva del Area Metropolitana.
Los diez municipios admiten altas manuales del equipo.

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
