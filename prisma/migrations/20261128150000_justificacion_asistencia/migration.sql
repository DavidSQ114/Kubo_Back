-- Bloque M3 · Justificación de faltas y tardanzas que envía el apoderado y revisa el tutor de la sección.

-- CreateEnum
CREATE TYPE "EstadoJustificacion" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "justificacion_asistencia" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asistencia_estudiante_id" UUID NOT NULL,
    "presentada_por_id" UUID NOT NULL,
    "motivo" TEXT NOT NULL,
    "archivo_clave" TEXT,
    "nombre_archivo" TEXT,
    "mime_type" TEXT,
    "tamano_bytes" INTEGER,
    "estado" "EstadoJustificacion" NOT NULL DEFAULT 'PENDIENTE',
    "revisada_por_id" UUID,
    "revisada_en" TIMESTAMPTZ(3),
    "motivo_rechazo" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "justificacion_asistencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "justificacion_asistencia_asistencia_estudiante_id_idx" ON "justificacion_asistencia"("asistencia_estudiante_id");

-- CreateIndex
CREATE INDEX "justificacion_asistencia_estado_created_at_idx" ON "justificacion_asistencia"("estado", "created_at");

-- AddForeignKey
ALTER TABLE "justificacion_asistencia" ADD CONSTRAINT "justificacion_asistencia_asistencia_estudiante_id_fkey" FOREIGN KEY ("asistencia_estudiante_id") REFERENCES "asistencia_estudiante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "justificacion_asistencia" ADD CONSTRAINT "justificacion_asistencia_presentada_por_id_fkey" FOREIGN KEY ("presentada_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "justificacion_asistencia" ADD CONSTRAINT "justificacion_asistencia_revisada_por_id_fkey" FOREIGN KEY ("revisada_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- El motivo del apoderado es obligatorio (hasta 500 caracteres) y el del rechazo, hasta 300
ALTER TABLE "justificacion_asistencia" ADD CONSTRAINT "ck_justificacion_asistencia_motivo"
  CHECK (char_length(btrim(motivo)) BETWEEN 1 AND 500
         AND (motivo_rechazo IS NULL OR char_length(motivo_rechazo) <= 300));

-- Una sola justificación pendiente por registro de asistencia
CREATE UNIQUE INDEX "uq_justificacion_pendiente_por_registro"
  ON "justificacion_asistencia" ("asistencia_estudiante_id") WHERE estado = 'PENDIENTE';
