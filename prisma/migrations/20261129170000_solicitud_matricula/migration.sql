-- Bloque M4 · fases 6 y 7: solicitud de matrícula del apoderado con documentos y su revisión.
-- CreateEnum
CREATE TYPE "EstadoSolicitudMatricula" AS ENUM ('EN_REVISION', 'OBSERVADA', 'APROBADA', 'MATRICULADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "EstadoDocumentoMatricula" AS ENUM ('EN_REVISION', 'APROBADO', 'OBSERVADO');

-- CreateTable
CREATE TABLE "solicitud_matricula" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "matricula_id" UUID NOT NULL,
    "proceso_id" UUID NOT NULL,
    "grado_id" UUID NOT NULL,
    "estado" "EstadoSolicitudMatricula" NOT NULL DEFAULT 'EN_REVISION',
    "creado_por_id" UUID NOT NULL,
    "enviada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitud_matricula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento_matricula" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "solicitud_id" UUID NOT NULL,
    "documento_requerido_id" UUID NOT NULL,
    "archivo_clave" TEXT NOT NULL,
    "nombre_archivo" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamano_bytes" INTEGER NOT NULL,
    "estado" "EstadoDocumentoMatricula" NOT NULL DEFAULT 'EN_REVISION',
    "observacion" TEXT,
    "revisado_por_id" UUID,
    "revisado_en" TIMESTAMPTZ(3),
    "subido_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_matricula_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "solicitud_matricula_matricula_id_key" ON "solicitud_matricula"("matricula_id");

-- CreateIndex
CREATE INDEX "solicitud_matricula_estado_enviada_en_idx" ON "solicitud_matricula"("estado", "enviada_en");

-- CreateIndex
CREATE UNIQUE INDEX "documento_matricula_solicitud_id_documento_requerido_id_key" ON "documento_matricula"("solicitud_id", "documento_requerido_id");

-- AddForeignKey
ALTER TABLE "solicitud_matricula" ADD CONSTRAINT "solicitud_matricula_matricula_id_fkey" FOREIGN KEY ("matricula_id") REFERENCES "matricula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_matricula" ADD CONSTRAINT "solicitud_matricula_proceso_id_fkey" FOREIGN KEY ("proceso_id") REFERENCES "proceso_matricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_matricula" ADD CONSTRAINT "solicitud_matricula_grado_id_fkey" FOREIGN KEY ("grado_id") REFERENCES "grado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_matricula" ADD CONSTRAINT "solicitud_matricula_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_matricula" ADD CONSTRAINT "documento_matricula_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitud_matricula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_matricula" ADD CONSTRAINT "documento_matricula_documento_requerido_id_fkey" FOREIGN KEY ("documento_requerido_id") REFERENCES "documento_requerido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_matricula" ADD CONSTRAINT "documento_matricula_revisado_por_id_fkey" FOREIGN KEY ("revisado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Una observación lleva su motivo.
ALTER TABLE "documento_matricula" ADD CONSTRAINT "ck_documento_matricula_observacion"
  CHECK (estado <> 'OBSERVADO' OR observacion IS NOT NULL);
