-- Bloque M4 · fase 4: lotes de cuotas extraordinarias del Coordinador académico.
-- CreateEnum
CREATE TYPE "DestinoLote" AS ENUM ('ALUMNO', 'SECCION', 'GRADO', 'ANIO');

-- CreateEnum
CREATE TYPE "EstadoLote" AS ENUM ('ACTIVO', 'ANULADO');

-- AlterTable
ALTER TABLE "concepto_cobro" ADD COLUMN     "lote_id" UUID;

-- CreateTable
CREATE TABLE "lote_cuota_extraordinaria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anio_academico_id" UUID NOT NULL,
    "concepto" VARCHAR(100) NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "fecha_vencimiento" DATE NOT NULL,
    "destino" "DestinoLote" NOT NULL,
    "destino_id" UUID,
    "destino_nombre" TEXT NOT NULL,
    "estado" "EstadoLote" NOT NULL DEFAULT 'ACTIVO',
    "creado_por_id" UUID NOT NULL,
    "anulado_por_id" UUID,
    "anulado_en" TIMESTAMPTZ(3),
    "motivo_anulacion" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lote_cuota_extraordinaria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lote_cuota_extraordinaria_anio_academico_id_created_at_idx" ON "lote_cuota_extraordinaria"("anio_academico_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_concepto_cobro_lote_matricula" ON "concepto_cobro"("lote_id", "matricula_id");

-- AddForeignKey
ALTER TABLE "concepto_cobro" ADD CONSTRAINT "concepto_cobro_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lote_cuota_extraordinaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote_cuota_extraordinaria" ADD CONSTRAINT "lote_cuota_extraordinaria_anio_academico_id_fkey" FOREIGN KEY ("anio_academico_id") REFERENCES "anio_academico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote_cuota_extraordinaria" ADD CONSTRAINT "lote_cuota_extraordinaria_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote_cuota_extraordinaria" ADD CONSTRAINT "lote_cuota_extraordinaria_anulado_por_id_fkey" FOREIGN KEY ("anulado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Solo las cuotas EXTRAORDINARIA tienen lote, y todas lo tienen.
ALTER TABLE "concepto_cobro" ADD CONSTRAINT "ck_concepto_cobro_lote"
  CHECK ((tipo = 'EXTRAORDINARIA') = (lote_id IS NOT NULL));

-- El monto es positivo y el destino tiene su id salvo si es todo el año.
ALTER TABLE "lote_cuota_extraordinaria" ADD CONSTRAINT "ck_lote_extraordinario_monto" CHECK (monto > 0);
ALTER TABLE "lote_cuota_extraordinaria" ADD CONSTRAINT "ck_lote_extraordinario_destino"
  CHECK ((destino = 'ANIO') = (destino_id IS NULL));
