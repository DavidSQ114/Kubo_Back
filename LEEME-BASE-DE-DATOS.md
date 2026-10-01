# Kubo · Base de datos (PostgreSQL + Prisma)

Basada en el diagrama de clases v4.2: 50 tablas, 34 enumeraciones, 93 relaciones.
Tablas y columnas en `snake_case` en la base de datos; en el código TypeScript se usan en `camelCase`.

## Qué trae esta carpeta

| Archivo | Para qué sirve |
|---|---|
| `docker-compose.yml` | Levanta PostgreSQL 16 en `localhost:5433` (usuario `kubo`, clave `kubo`, base `kubo_dev`); el 5432 del host lo usa el PostgreSQL instalado en Windows |
| `.env.example` | Cadena de conexión `DATABASE_URL` (copiar como `.env`) |
| `prisma.config.ts` | Configuración de Prisma (schema dividido, carpeta de migraciones, conexión) |
| `prisma/schema/*.prisma` | El modelo: un archivo por módulo + `enums.prisma` + `schema.prisma` (generador y datasource) |
| `prisma/sql/restricciones.sql` | Lo que Prisma no expresa: 11 índices únicos parciales, 26 CHECK y 5 triggers |
| `prisma/seed.sql` | Datos iniciales: 5 grados, 11 áreas, 28 competencias (CNEB), 10 cursos, 10 parámetros y el administrador inicial |
| `prisma/sql/pruebas.sql` | 17 pruebas de las reglas (se ejecutan dentro de una transacción y no dejan datos) |
| `src/platform/db/prisma.ts` | Cliente Prisma único para toda la app (capa `platform/db` de la guía de arquitectura) |
| `package.scripts.json` | Scripts `db:*` para copiar dentro del `package.json` del proyecto |

## Pasos (una sola vez)

Requisitos: Docker Desktop abierto y el proyecto Next.js ya creado. Copia el contenido de esta carpeta en la raíz del proyecto.

```powershell
# 1. Dependencias
npm install -D prisma dotenv
npm install @prisma/client @prisma/adapter-pg pg

# 2. Variables y base de datos
copy .env.example .env
docker compose up -d db

# 3. Validar el modelo y crear las tablas (migración 1)
npx prisma validate
npx prisma migrate dev --name init

# 4. Restricciones (migración 2): crear vacía, pegar el SQL y aplicar
npx prisma migrate dev --create-only --name restricciones
#    -> abrir prisma/migrations/<fecha>_restricciones/migration.sql
#    -> pegar TODO el contenido de prisma/sql/restricciones.sql y guardar
npx prisma migrate dev

# 5. Datos iniciales
npm run db:seed

# 6. (Opcional) Comprobar las reglas: deben salir 17 líneas "OK"
docker compose exec db psql -U kubo -d kubo_dev -q -t -A -f /kubo-prisma/sql/pruebas.sql
```

Administrador inicial: `admin@kubo.edu.pe` / `Kubo#2026`. El sistema obliga a cambiar la contraseña en el primer ingreso (RF43).
Los montos de matrícula y pensión del seed son de ejemplo: ajustarlos antes de abrir la matrícula.

## Reglas que viven en la base de datos

- **Matrícula:** una sola activa por estudiante y año; en `EN_PROCESO` puede no tener sección ni responsable, pero no puede pasar a `MATRICULADO` sin ambos; el responsable debe ser apoderado del mismo estudiante; retiro y anulación exigen fecha y motivo.
- **Horarios:** un solo horario `PUBLICADO` por sección; sin cruces de aula, docente ni sección en los horarios en vigor (`en_vigor`, que un trigger mantiene al publicar o archivar); el detalle debe coincidir con su asignación. Para publicar una versión nueva: archivar la anterior y publicar la nueva **en la misma transacción**.
- **Cobros:** una cuota de matrícula y una pensión por mes (1–12); montos positivos.
- **Notas:** una solicitud de rectificación abierta por nota; una regla de consolidación vigente por año.
- **Archivos:** máximo 5 MB.
- **Auditoría:** `registro_auditoria` no se puede modificar ni borrar.
- **Alertas:** `notificacion.clave_deduplicacion` es única; insertar con `ON CONFLICT DO NOTHING` (o `createMany({ skipDuplicates: true })`) para que cada alerta salga una sola vez.

Los triggers devuelven mensajes con un código al inicio (`AFORO_EXCEDE_AULA`, `RESPONSABLE_NO_VINCULADO`, `DETALLE_INCOHERENTE`, `REGISTRO_AUDITORIA_INMUTABLE`) para que el backend los traduzca a errores `{error:{code,message}}`.

## Si algo no calza

- **`npx prisma validate` da error:** este schema está escrito para **Prisma 7** (generador `prisma-client` y conexión en `prisma.config.ts`). Con Prisma 6, agrega `url = env("DATABASE_URL")` dentro de `datasource db` en `prisma/schema/schema.prisma`.
- **Una migración futura quiere borrar índices `uq_…` o restricciones `ck_…`:** Prisma no conoce los índices parciales. Crea esa migración con `--create-only`, borra esas líneas `DROP …` del SQL y luego aplícala.
- **Las fechas que guarda la app no coinciden con `now()` (5 horas de diferencia):** la base y la conexión trabajan en UTC, porque el adaptador `@prisma/adapter-pg` envía las fechas en UTC sin desplazamiento. Lo fijan `src/platform/db/prisma.ts` (`options: "-c timezone=UTC"`) y `DATABASE_URL` (`&options=-c%20TimeZone%3DUTC`, ver `.env.example`); no quitar esa opción ni crear otro cliente sin ella. La hora de Lima solo se aplica al mostrar las fechas (`src/lib/formato.ts`).
- **Tu base se creó cuando `docker-compose.yml` tenía `TZ: America/Lima`:** quedó con esa zona por defecto. Pásala a UTC una sola vez y actualiza `DATABASE_URL` en tu `.env` como en `.env.example`:

  ```powershell
  docker compose exec db psql -U kubo -d kubo_dev -c "ALTER DATABASE kubo_dev SET timezone TO 'UTC';"
  # Opcional: las filas que la app guardó antes del cambio quedaron 5 horas adelantadas; esto vuelve al seed
  npm run db:reset
  ```
- **Cambiaste el modelo:** cambia el diagrama y el `.prisma` a la vez (regla de la guía de arquitectura), y crea una migración nueva; nunca edites una migración ya aplicada.
