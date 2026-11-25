-- Bloque M4 · fase 2: mora ligada a su pensión (idempotente) y anulación de cuotas con motivo.
-- AlterTable
ALTER TABLE "concepto_cobro" ADD COLUMN     "anulado_en" TIMESTAMPTZ(3),
ADD COLUMN     "anulado_por_id" UUID,
ADD COLUMN     "cuota_origen_id" UUID,
ADD COLUMN     "motivo_anulacion" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "uq_concepto_cobro_cuota_origen" ON "concepto_cobro"("cuota_origen_id");

-- AddForeignKey
ALTER TABLE "concepto_cobro" ADD CONSTRAINT "concepto_cobro_cuota_origen_id_fkey" FOREIGN KEY ("cuota_origen_id") REFERENCES "concepto_cobro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concepto_cobro" ADD CONSTRAINT "concepto_cobro_anulado_por_id_fkey" FOREIGN KEY ("anulado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Solo las cuotas MORA tienen pensión de origen, y todas la tienen.
ALTER TABLE "concepto_cobro" ADD CONSTRAINT "ck_concepto_cobro_mora_origen"
  CHECK ((tipo = 'MORA') = (cuota_origen_id IS NOT NULL));
