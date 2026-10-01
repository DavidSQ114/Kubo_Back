# Kubo · Despliegue (Vercel + Neon)

Ambiente **temporal** para mostrar avances mientras se prepara el despliegue definitivo en AWS (Amplify + RDS + S3, ver `README.md`). Cuando AWS esté listo, este ambiente se apaga.

**Solo datos de prueba.** En este ambiente no se cargan datos reales de alumnos, apoderados ni docentes, ni copias de una base que los contenga (RNF14, protección de datos personales).

## Cómo está desplegado

| Pieza | Dónde | Detalle |
|---|---|---|
| Aplicación (frontend + API) | Vercel | Proyecto Next.js conectado al repositorio; cada push a `main` genera un despliegue |
| Base de datos | Neon | PostgreSQL administrado, en UTC por defecto |
| Archivos, correo y logs en disco | — | No disponibles en este ambiente (ver variables) |

En cada despliegue Vercel ejecuta `npm install`, que lanza `prisma generate` (script `postinstall`, porque el cliente Prisma está en `.gitignore`), y luego `npm run build`. La compilación **no necesita ninguna variable de entorno**: todas se leen al atender una petición. Vercel **no** aplica migraciones; se aplican a mano (ver más abajo).

## Variables de entorno

Se definen en Vercel → Project → Settings → Environment Variables. Nunca se suben al repositorio: ni el `.env`, ni las URL de Neon.

| Variable | Valor | Notas |
|---|---|---|
| `DATABASE_URL` | URL **con pooler** de Neon (el host incluye `-pooler`) | Vercel abre muchas conexiones cortas; el pooler evita agotar las de la base |
| `JWT_SECRET` | Texto aleatorio de 32 caracteres o más | Distinto al de desarrollo. Generar con `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `APP_URL` | URL pública del proyecto en Vercel, sin barra final | Se usa en los enlaces de los correos |
| `LOG_DIR` | vacío | El disco de Vercel es de solo lectura: el log va a la consola (Vercel → Logs) |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | vacíos | Sin SMTP no se envía ningún correo (ver limitaciones) |

Las dos URL de Neon están en su panel (Connection Details): la que tiene `-pooler` en el host va en Vercel; la directa (sin `-pooler`) solo se usa desde tu computadora para migrar.

## Migraciones y datos iniciales en Neon

Las migraciones se aplican desde tu computadora con la **URL directa** (sin `-pooler`): `prisma migrate` necesita una conexión de sesión que el pooler no ofrece.

```powershell
# La variable del shell tiene prioridad sobre el .env; solo dura esta ventana
$env:DATABASE_URL = "<URL directa de Neon>"

npm run db:deploy          # aplica las migraciones pendientes, sin borrar nada
npm run db:seed:remoto     # solo la primera vez: carga los datos iniciales

$env:DATABASE_URL = $null  # vuelve a usar la base local del .env
```

- **Migración nueva:** se crea y se prueba en local (`npx prisma migrate dev --name <descripcion>`), se sube en el pull request y, **antes** de unirlo a `main`, se aplica en Neon con `npm run db:deploy`. Así el código nuevo nunca corre contra una base sin migrar.
- **`db:seed:remoto`** ejecuta `prisma/seed.sql` con `prisma db execute`, sin Docker. Es idempotente: repetirlo no duplica nada.
- **Nunca** ejecutar `npm run db:reset` ni `npm run db:migrate` con la URL de Neon en `DATABASE_URL`: el primero borra la base.
- El administrador inicial es el del seed (`LEEME-BASE-DE-DATOS.md`); cambiar su contraseña en el primer ingreso.

## Limitaciones de este ambiente

- **Correo:** sin SMTP no llegan la contraseña temporal de las cuentas nuevas, el enlace de recuperación ni el aviso de suspensión. Cada intento queda en el log como `SMTP no configurado`.
- **Logs:** no hay archivo con rotación; solo lo que conserve Vercel.
- **Zona horaria:** base y conexión en UTC; la hora de Lima se aplica al mostrar las fechas. La app abre cada conexión con `options=-c timezone=UTC`, que el pooler de Neon admite según su documentación. Si en los logs aparece `unsupported startup parameter in options`, avisar al equipo y usar temporalmente la URL directa en `DATABASE_URL`.

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| El despliegue falla en `prisma generate` | Cambió `prisma.config.ts` o el schema; reproducir en local con `npm run postinstall` |
| Error 500 al iniciar sesión, log `JWT_SECRET no está configurado…` | Falta `JWT_SECRET` en Vercel o tiene menos de 32 caracteres |
| Error 500 en cualquier consulta, log con tabla o columna inexistente | Falta aplicar migraciones en Neon (`npm run db:deploy`) |
| `npm run db:deploy` se queda colgado o falla por bloqueo | Se usó la URL con `-pooler`; repetir con la URL directa |
