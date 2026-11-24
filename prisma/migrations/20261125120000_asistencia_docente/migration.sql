-- Kubo · Registro de ingreso de docentes (US32, AD-14).
-- 1) registrado_por_id admite NULL: la falta que marca la verificación automática de la hora límite no la registra
--    ningún usuario. Cuando el administrador marca «Asistió», el registro pasa a ser suyo.
-- 2) Índice por fecha: la pantalla AD-14 y la verificación automática leen la asistencia de un día.
-- 3) ck_asistencia_docente_horas: la salida necesita un ingreso y no puede ser anterior a él.
-- 4) Parámetros de la jornada docente: solo los cargaba el seed, que no se ejecuta en los despliegues (AWS y Neon solo
--    corren «prisma migrate deploy»). Esta migración los carga si faltan; no toca un valor ya registrado.

-- AlterTable
ALTER TABLE "asistencia_docente" ALTER COLUMN "registrado_por_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "asistencia_docente_fecha_idx" ON "asistencia_docente"("fecha");

-- CHECK que Prisma no expresa
ALTER TABLE "asistencia_docente" ADD CONSTRAINT "ck_asistencia_docente_horas"
  CHECK ("hora_salida" IS NULL OR ("hora_ingreso" IS NOT NULL AND "hora_salida" >= "hora_ingreso"));

-- Parámetros generales (sin año). Los mismos valores y descripciones que prisma/seed.sql.
INSERT INTO parametro_institucion (clave, valor, descripcion, actualizado_por_id)
SELECT v.clave, v.valor::jsonb, v.descripcion,
       -- el administrador más antiguo, si ya hay alguno; en una base recién creada todavía no existe: NULL
       (SELECT u.id FROM usuario u JOIN administrador a ON a.persona_id = u.persona_id ORDER BY u.created_at LIMIT 1)
FROM (VALUES
  ('HORA_INICIO_JORNADA_DOCENTE', '"07:30"', 'Hasta esta hora el ingreso del docente es Puntual; después, Tardanza (US32)'),
  ('HORA_LIMITE_ASISTENCIA_DOCENTE', '"08:00"', 'Hora límite: el docente sin marcar queda con Inasistencia (US32)')
) AS v(clave, valor, descripcion)
ON CONFLICT (clave) WHERE anio_academico_id IS NULL DO NOTHING;
