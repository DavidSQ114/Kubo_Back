-- Kubo · Asistencia de alumnos (US35, US36, US45, US52).
-- 1) asistencia_estudiante guarda el estado que tenía antes de la última corrección (US36).
-- 2) aviso_asistencia: avisos por umbral de inasistencias ya enviados; la clave única (matrícula, tipo, periodo)
--    impide repetirlos (US52).
-- 3) Parámetros de asistencia: solo los cargaba el seed, que no se ejecuta en los despliegues (AWS y Neon solo corren
--    «prisma migrate deploy»). Esta migración los carga si faltan; no toca un valor ya registrado.

-- CreateEnum
CREATE TYPE "TipoAvisoAsistencia" AS ENUM ('FALTAS_MES', 'PORCENTAJE_AVISO', 'PORCENTAJE_RIESGO');

-- AlterTable
ALTER TABLE "asistencia_estudiante" ADD COLUMN     "estado_anterior" "EstadoAsistencia";

-- CreateTable
CREATE TABLE "aviso_asistencia" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "matricula_id" UUID NOT NULL,
    "tipo" "TipoAvisoAsistencia" NOT NULL,
    "periodo" TEXT NOT NULL,
    "faltas" INTEGER NOT NULL,
    "correos_enviados" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aviso_asistencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aviso_asistencia_matricula_id_tipo_periodo_key" ON "aviso_asistencia"("matricula_id", "tipo", "periodo");

-- AddForeignKey
ALTER TABLE "aviso_asistencia" ADD CONSTRAINT "aviso_asistencia_matricula_id_fkey" FOREIGN KEY ("matricula_id") REFERENCES "matricula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Parámetros generales de asistencia (sin año). Los mismos valores y descripciones que prisma/seed.sql.
INSERT INTO parametro_institucion (clave, valor, descripcion, actualizado_por_id)
SELECT v.clave, v.valor::jsonb, v.descripcion,
       -- el administrador más antiguo, si ya hay alguno; en una base recién creada todavía no existe: NULL
       (SELECT u.id FROM usuario u JOIN administrador a ON a.persona_id = u.persona_id ORDER BY u.created_at LIMIT 1)
FROM (VALUES
  ('UMBRAL_INASISTENCIA', '0.20', 'Porcentaje anual de faltas que activa la alerta de riesgo (RF54)'),
  ('UMBRAL_INASISTENCIA_AVISO', '0.15', 'Porcentaje anual de faltas que activa el aviso previo (RF54)'),
  ('UMBRAL_FALTAS_MES', '3', 'Faltas injustificadas en un mes que activan la alerta mensual (RF54)'),
  ('PLAZO_CORRECCION_ASISTENCIA_H', '24', 'Horas que tiene el docente para corregir la asistencia')
) AS v(clave, valor, descripcion)
ON CONFLICT (clave) WHERE anio_academico_id IS NULL DO NOTHING;
