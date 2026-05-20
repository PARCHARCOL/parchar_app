# Parchar

App web para descubrir sitios por categoria (`moto`, `carro`, `romantico`, `bbb`) y registrar negocios con video obligatorio entre 10 y 13 segundos.

## Tecnologia

- Backend: Node.js nativo (`http`, `node:sqlite`)
- Frontend: HTML, CSS y JavaScript vanilla
- Base de datos: SQLite (`/data/parchar.db`)
- Archivos multimedia: `/uploads`

## Ejecutar local

1. Abre terminal en esta carpeta:

```powershell
cd C:\Users\luxury\Desktop\nomina\parchar
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
- El formulario de negocio exige video y valida que dure de 10 a 13 segundos.
- Se guarda info completa del usuario y del negocio.
- Moto y carro muestran lugares cercanos cuando se comparte ubicacion.

## Despliegue en la nube

Se puede subir a Render o Railway como servicio Node.

- Start command: `node server.js`
- Puerto: usar variable de entorno `PORT` (la app ya lo soporta)

## Acceso permanente (recomendado)

Para que no sea temporal debes dejarla en hosting 24/7 con dominio.

### Opcion recomendada: Render + dominio propio

1. Sube esta carpeta a GitHub (repo).
2. En Render crea un **Web Service** desde ese repo.
3. Render detectara `render.yaml` y creara:
   - servicio Node
   - disco persistente para DB y videos
4. Espera deploy completo y prueba URL `onrender.com`.
5. En Render agrega tu dominio (ej: `parchar.co`) en `Settings > Custom Domains`.
6. Configura DNS en tu proveedor de dominio y luego haz `Verify` en Render.

Con eso queda estable y sin vencimiento de link.

Importante: en Render, los discos persistentes aplican en planes de pago.

## Publicar ya en internet (URL HTTPS)

Si quieres ensayarla de inmediato desde cualquier celular sin subirla aun a Render/Railway:

1. Enciende URL publica:

```powershell
cd C:\Users\luxury\Desktop\nomina\parchar
powershell -ExecutionPolicy Bypass -File .\start-public.ps1
```

2. Detener URL publica cuando termines:

```powershell
powershell -ExecutionPolicy Bypass -File .\stop-public.ps1
```

La URL publica activa tambien queda guardada en:
`C:\Users\luxury\Desktop\nomina\parchar\.runtime\public-url.txt`

Tambien puedes usar doble clic:
- `C:\Users\luxury\Desktop\nomina\parchar\start-public.cmd`
- `C:\Users\luxury\Desktop\nomina\parchar\stop-public.cmd`
