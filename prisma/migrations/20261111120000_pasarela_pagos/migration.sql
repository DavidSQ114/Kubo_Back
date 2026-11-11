-- Kubo · Pago en línea desde el portal del apoderado (US70) y conciliación y devolución (US71).
-- Medio PASARELA y motivo DEVUELTO; origen, referencia externa y motivo de observación en operacion_pago (una
-- operación de la pasarela la registra el Sistema, sin usuario); tabla intento_pago.
-- Compatible con la versión anterior: las operaciones existentes quedan con origen TESORERIA y su registrador.
-- CreateEnum
CREATE TYPE "OrigenPago" AS ENUM ('TESORERIA', 'PASARELA');

-- CreateEnum
CREATE TYPE "EstadoIntentoPago" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'EXPIRADO', 'OBSERVADO');

-- AlterEnum
ALTER TYPE "MedioPago" ADD VALUE 'PASARELA';

-- AlterEnum
ALTER TYPE "MotivoAnulacion" ADD VALUE 'DEVUELTO';

-- AlterTable
ALTER TABLE "operacion_pago" ADD COLUMN     "motivo_observacion" TEXT,
ADD COLUMN     "origen" "OrigenPago" NOT NULL DEFAULT 'TESORERIA',
ADD COLUMN     "referencia_externa" TEXT,
ALTER COLUMN "registrado_por_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "intento_pago" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "matricula_id" UUID NOT NULL,
    "creado_por_id" UUID NOT NULL,
    "concepto_ids" UUID[],
    "monto" DECIMAL(10,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "estado" "EstadoIntentoPago" NOT NULL DEFAULT 'PENDIENTE',
    "referencia_externa" TEXT NOT NULL,
    "pasarela" TEXT NOT NULL,
    "orden_externa_id" TEXT,
    "url_checkout" TEXT,
    "estado_externo" TEXT,
    "detalle" TEXT,
    "expira_en" TIMESTAMPTZ(3) NOT NULL,
    "conciliado_en" TIMESTAMPTZ(3),
    "operacion_pago_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intento_pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_intento_pago_referencia_externa" ON "intento_pago"("referencia_externa");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intento_pago_orden_externa" ON "intento_pago"("orden_externa_id");

-- CreateIndex
CREATE UNIQUE INDEX "intento_pago_operacion_pago_id_key" ON "intento_pago"("operacion_pago_id");

-- CreateIndex
CREATE INDEX "intento_pago_estado_created_at_idx" ON "intento_pago"("estado", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_operacion_pago_referencia_externa" ON "operacion_pago"("referencia_externa");

-- CreateIndex
CREATE INDEX "operacion_pago_origen_estado_idx" ON "operacion_pago"("origen", "estado");

-- AddForeignKey
ALTER TABLE "intento_pago" ADD CONSTRAINT "intento_pago_matricula_id_fkey" FOREIGN KEY ("matricula_id") REFERENCES "matricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intento_pago" ADD CONSTRAINT "intento_pago_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intento_pago" ADD CONSTRAINT "intento_pago_operacion_pago_id_fkey" FOREIGN KEY ("operacion_pago_id") REFERENCES "operacion_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Solo una operación de la pasarela puede no tener usuario registrador (actor Sistema)
ALTER TABLE "operacion_pago" ADD CONSTRAINT ck_operacion_pago_registrador
  CHECK (origen = 'PASARELA' OR registrado_por_id IS NOT NULL);

-- Una operación de la pasarela siempre guarda el ID de la order (idempotencia del webhook)
ALTER TABLE "operacion_pago" ADD CONSTRAINT ck_operacion_pago_referencia_pasarela
  CHECK (origen = 'TESORERIA' OR referencia_externa IS NOT NULL);

ALTER TABLE "intento_pago" ADD CONSTRAINT ck_intento_pago_monto CHECK (monto > 0);
ALTER TABLE "intento_pago" ADD CONSTRAINT ck_intento_pago_cuotas CHECK (cardinality(concepto_ids) >= 1);
