# Moderacion del Muro creativo

## Activacion en Render

En el servicio parchar-app, Environment, configurar OPENAI_API_KEY con una clave
del proyecto OpenAI del propietario. No guardarla en Git, archivos publicos ni chats.
La clave solo se usa en el servidor con https://api.openai.com/v1/moderations y
omni-moderation-latest. WALL_AI_MODERATION=off desactiva el envio externo.
Sin clave o ante errores, las creaciones NO se publican automaticamente.

## Flujo

- Autenticacion, validacion de trazos, limite de tamano y frecuencia.
- Duplicados propios recientes: no se crea otra publicacion identica.
- Posibles correos, telefonos/identificaciones, direcciones particulares, enlaces,
  spam, amenazas y lenguaje que necesita contexto: revision humana, sin envio externo.
- Texto que sugiera material sexual con menores: revision humana sin envio a OpenAI.
  Este filtro no sustituye salvaguardas especializadas de proteccion de menores.
- El servidor renderiza los trazos validados; no confia en miniaturas del navegador.
- Solo se envian nombre publico, texto y el dibujo. No se envian datos de la cuenta.
- La interfaz informa del tratamiento. Los clientes antiguos sin el indicador de
  divulgacion conservan revision manual; no se reenvian publicaciones anteriores.
- Cola persistente con lease, recuperacion de trabajos interrumpidos y tres intentos.
  Un proceso ejecuta hasta cuatro analisis consecutivos y vuelve cada 15 segundos.
- Respuesta incompleta, timeout, rechazo del proveedor, error de imagen o falta de
  configuracion: nunca aprobar. Tras tres fallos queda para revision humana.
- Clasificaciones y puntuaciones se registran con version de politica y modelo.
- El contenido claramente grave puede retirarse; los casos dudosos quedan pendientes.
  No hay bloqueos permanentes automaticos de autores.
- Las decisiones humanas, retiros del autor y bloqueos prevalecen sobre respuestas
  tardias de la IA. Desbloquear no republica contenido.

WALL_MODERATION_REVIEW_THRESHOLD ajusta el umbral conservador de puntuaciones
(por defecto 0.2; rango 0.05-0.8). Estas puntuaciones no son probabilidades
calibradas: evaluar resultados reales y falsos positivos antes de relajar el umbral.
La IA y las heuristicas no garantizan detectar todos los incumplimientos ni
comprueban derechos de autor, veracidad o identidad.

Admin ofrece pendientes, reportes, motivos y estado de configuracion. Los avisos
se agregan al sondeo existente, no se reproduce un sonido por cada publicacion.
Los endpoints de moderacion siguen restringidos a admin y asesor.

Documentacion: https://developers.openai.com/api/docs/guides/moderation
