-- Bloque M1: rol y perfil del Coordinador académico (separación de accesos con el Administrador).
-- AlterEnum
ALTER TYPE "Rol" ADD VALUE 'COORDINADOR';

-- CreateTable
CREATE TABLE "coordinador" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "persona_id" UUID NOT NULL,
    "cargo" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coordinador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coordinador_persona_id_key" ON "coordinador"("persona_id");

-- AddForeignKey
ALTER TABLE "coordinador" ADD CONSTRAINT "coordinador_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

