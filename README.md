# Parchar

App web para descubrir sitios por categoria (`moto`, `carro`, `romantico`, `bbb`) y registrar negocios con video obligatorio entre 15 y 20 segundos.

## Tecnologia

- Backend: Node.js nativo (`http`) con Node `>=22.5`
- Frontend: HTML, CSS y JavaScript vanilla
- Base de datos local: SQLite (`/data/parchar.db`) cuando no existe `DATABASE_URL`
- Base de datos cloud: PostgreSQL cuando existe `DATABASE_URL`
- Archivos multimedia locales: `/uploads` cuando no hay credenciales Cloudinary
- Archivos multimedia cloud: Cloudinary cuando existen `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET`

## Ejecutar local

1. Abre terminal en esta carpeta:

```powershell
cd C:\Users\luxury\Desktop\nomina\parchar_app
```

2. Inicia el servidor:

```powershell
node server.js
```

3. Abre en navegador:

`http://localhost:8080`

## Reglas implementadas

- La app tiene 5 botones principales:
  - En moto
  - En carro
  - Romantico
  - BBB
  - Clientes
- Los negocios deben ser registrados por clientes (duenos de locales).
- El formulario de negocio exige video y valida que dure de 15 a 20 segundos.
- RUT y Camara de Comercio se reciben solo en PDF.
- Se guarda info completa del usuario y del negocio.
- Moto y carro muestran lugares cercanos cuando se comparte ubicacion.
- El boton Parchar reemplaza el "me gusta": acumula conteo por local y permite grabar una resena en video de 15 segundos.
- Las resenas en video duran 15 dias activas y se publican en el muro social `/social.html`; el conteo Parchar queda acumulado.

## Acceso interno

El panel `/admin.html` requiere inicio de sesion y maneja dos perfiles:

- `admin`: modera negocios y publica campanas en el banner.
- `asesor`: consulta solicitudes de pauta, registra contactos y aprueba o rechaza locales pendientes.

Cuentas iniciales para desarrollo local:

- Admin: usuario `admin`, clave `ParcharAdmin2026!`
- Asesor: usuario `asesor`, clave `ParcharAsesor2026!`

El usuario `admin` puede crear asesores reales desde el panel interno.
Cada asesor entra con su propio usuario y puede cambiar su clave en `Mi acceso`.

El modulo de publicidad se maneja como campanas: cada pauta tiene archivo, enlace, fecha de inicio, fecha de fin, prioridad, estado, vistas y clics. La app rota automaticamente las campanas activas y vigentes.

Formato recomendado para piezas publicitarias:

- Imagen o video horizontal tipo banner, no vertical.
- Medida sugerida: 1600 x 600 px o 1920 x 720 px.
- Video MP4 de 6 a 12 segundos, maximo 15 MB.
- El audio no se reproduce en el banner publico.
- Mantener producto, logo y texto principal en el centro.
- Evitar letras pequenas, reels, stories y bordes con informacion importante, porque el banner se adapta a celular y PC.

Antes de desplegar, cambia estas credenciales con variables de entorno:

- `PARCHAR_ADMIN_USERNAME`
- `PARCHAR_ADMIN_PASSWORD`
- `PARCHAR_ADVISOR_USERNAME`
- `PARCHAR_ADVISOR_PASSWORD`

Si pierdes la clave del admin, puedes recuperarla temporalmente desde Render:

- Agrega `PARCHAR_ADMIN_RESET_PASSWORD` con una clave nueva de minimo 8 caracteres.
- Si el usuario admin no es `admin`, agrega tambien `PARCHAR_ADMIN_RESET_USERNAME`.
- Redespliega la app e inicia sesion con esa clave nueva.
- Despues de entrar, borra `PARCHAR_ADMIN_RESET_PASSWORD` de Render para que no quede reseteando en cada reinicio.

## Despliegue en la nube

Se puede subir a Render o Railway como servicio Node.

- Start command: `node server.js`
- Puerto: usar variable de entorno `PORT` (la app ya lo soporta)
- `DATABASE_MODE=sqlite` fuerza SQLite e ignora un `DATABASE_URL` antiguo.
- `DATABASE_MODE=postgres` usa PostgreSQL y requiere un `DATABASE_URL` valido.
- Sin `DATABASE_URL`, la app usa SQLite sobre el disco persistente configurado.
- Con `DATABASE_URL`, la app usa PostgreSQL.
- Sin credenciales Cloudinary, los archivos se guardan en `/uploads`.
- Con credenciales Cloudinary, videos y documentos se guardan en Cloudinary.

Importante para Render gratis: SQLite y `/uploads` quedan en disco temporal. En cada deploy o reinicio se pueden perder locales, campanas, solicitudes y archivos locales. Para no perder datos en plan gratis usa PostgreSQL externo, por ejemplo Neon o Supabase, con `DATABASE_MODE=postgres` y `DATABASE_URL`, y usa Cloudinary para todos los archivos.

La app trae una proteccion de produccion: si detecta que esta corriendo en Render sin PostgreSQL o sin Cloudinary, no arranca. Es mejor que falle el deploy con un mensaje claro a que arranque con datos temporales y despues borre todo. Solo desactiva esa proteccion si tienes infraestructura persistente pagada:

- `ALLOW_RENDER_SQLITE=true` permite SQLite en Render bajo tu responsabilidad.
- `ALLOW_RENDER_LOCAL_UPLOADS=true` permite archivos locales en Render bajo tu responsabilidad.

## Acceso permanente (recomendado)

Para que no sea temporal debes dejarla en hosting 24/7 con dominio.

### Opcion recomendada: Render + dominio propio

1. Sube esta carpeta a GitHub (repo).
2. En Render crea un **Web Service** desde ese repo.
3. Crea una base PostgreSQL externa en Neon o Supabase.
4. En Render > Environment deja estas variables:
   - `DATABASE_MODE=postgres`
   - `DATABASE_URL=...` cadena de conexion de Neon/Supabase
   - `CLOUDINARY_CLOUD_NAME=...`
   - `CLOUDINARY_API_KEY=...`
   - `CLOUDINARY_API_SECRET=...`
5. Si el servicio viejo tenia `DATABASE_MODE=sqlite`, cambialo a `postgres`. Si tenia `DATA_DIR` o `UPLOADS_DIR`, ya no son necesarios para Render gratis.
6. Espera deploy completo y prueba URL `onrender.com`.
7. En Render agrega tu dominio (ej: `parchar.co`) en `Settings > Custom Domains`.
8. Configura DNS en tu proveedor de dominio y luego haz `Verify` en Render.

Con eso queda estable y sin vencimiento de link.

Importante: en Render, los discos persistentes aplican en planes de pago. En plan gratis no uses SQLite ni uploads locales para datos reales.

## Publicar ya en internet (URL HTTPS)

Si quieres ensayarla de inmediato desde cualquier celular sin subirla aun a Render/Railway:

1. Enciende URL publica:

```powershell
cd C:\Users\luxury\Desktop\nomina\parchar_app
powershell -ExecutionPolicy Bypass -File .\start-public.ps1
```

2. Detener URL publica cuando termines:

```powershell
powershell -ExecutionPolicy Bypass -File .\stop-public.ps1
```

La URL publica activa tambien queda guardada en:
`C:\Users\luxury\Desktop\nomina\parchar_app\.runtime\public-url.txt`

Tambien puedes usar doble clic:
- `C:\Users\luxury\Desktop\nomina\parchar_app\start-public.cmd`
- `C:\Users\luxury\Desktop\nomina\parchar_app\stop-public.cmd`
