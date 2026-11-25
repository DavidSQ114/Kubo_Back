-- Bloque M2 · Ítems de evaluación con pesos (item_evaluacion) y sus calificaciones (calificacion_item). La nota de una
-- competencia con ítems se calcula y queda en nota con el origen ITEMS en bitacora_nota; logro_nuevo admite null
-- para registrar que una nota se quitó (al alumno le faltan ítems o los pesos dejaron de sumar 100).

-- AlterEnum
ALTER TYPE "OrigenCambioNota" ADD VALUE 'ITEMS';

-- AlterTable
ALTER TABLE "bitacora_nota" ALTER COLUMN "logro_nuevo" DROP NOT NULL;

-- CreateTable
CREATE TABLE "item_evaluacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cierre_id" UUID NOT NULL,
    "competencia_plan_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "peso" DECIMAL(5,2) NOT NULL,
    "orden" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_evaluacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calificacion_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "item_id" UUID NOT NULL,
    "matricula_id" UUID NOT NULL,
    "valor" "Logro" NOT NULL,
    "registrado_por_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calificacion_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_evaluacion_cierre_id_competencia_plan_id_idx" ON "item_evaluacion"("cierre_id", "competencia_plan_id");

-- CreateIndex
CREATE INDEX "item_evaluacion_competencia_plan_id_idx" ON "item_evaluacion"("competencia_plan_id");

-- CreateIndex
CREATE INDEX "calificacion_item_matricula_id_idx" ON "calificacion_item"("matricula_id");

-- CreateIndex
CREATE UNIQUE INDEX "calificacion_item_item_id_matricula_id_key" ON "calificacion_item"("item_id", "matricula_id");

-- AddForeignKey
ALTER TABLE "item_evaluacion" ADD CONSTRAINT "item_evaluacion_cierre_id_fkey" FOREIGN KEY ("cierre_id") REFERENCES "cierre_calificacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_evaluacion" ADD CONSTRAINT "item_evaluacion_competencia_plan_id_fkey" FOREIGN KEY ("competencia_plan_id") REFERENCES "competencia_plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calificacion_item" ADD CONSTRAINT "calificacion_item_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_evaluacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calificacion_item" ADD CONSTRAINT "calificacion_item_matricula_id_fkey" FOREIGN KEY ("matricula_id") REFERENCES "matricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calificacion_item" ADD CONSTRAINT "calificacion_item_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Nombre de 1 a 100 caracteres y peso mayor que 0 y hasta 100
ALTER TABLE item_evaluacion ADD CONSTRAINT ck_item_evaluacion_nombre
  CHECK (btrim(nombre) <> '' AND char_length(nombre) <= 100);
ALTER TABLE item_evaluacion ADD CONSTRAINT ck_item_evaluacion_peso CHECK (peso > 0 AND peso <= 100);

-- Los ítems y sus calificaciones solo cambian con el registro de notas ABIERTO, como las notas (US40). Mismo mensaje
-- que tg_nota_registro_cerrado, que ruta() convierte en REGISTRO_CERRADO. Sin excepción para las rectificaciones: la
-- rectificación (US41) cambia la nota de la competencia, no sus ítems. Si el cierre ya no existe (cascada), pasa.
CREATE OR REPLACE FUNCTION fn_item_evaluacion_registro_cerrado() RETURNS trigger AS $$
DECLARE
  v_estado "EstadoCierre";
BEGIN
  SELECT estado INTO v_estado FROM cierre_calificacion
   WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.cierre_id ELSE NEW.cierre_id END;
  IF v_estado IN ('CERRADO', 'PUBLICADO') THEN
    RAISE EXCEPTION 'REGISTRO_CERRADO: el registro de notas está cerrado y no puede modificarse directamente'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_item_evaluacion_registro_cerrado
  BEFORE INSERT OR UPDATE OR DELETE ON item_evaluacion
  FOR EACH ROW EXECUTE FUNCTION fn_item_evaluacion_registro_cerrado();

CREATE OR REPLACE FUNCTION fn_calificacion_item_registro_cerrado() RETURNS trigger AS $$
DECLARE
  v_estado "EstadoCierre";
BEGIN
  SELECT c.estado INTO v_estado
    FROM item_evaluacion i JOIN cierre_calificacion c ON c.id = i.cierre_id
   WHERE i.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.item_id ELSE NEW.item_id END;
  IF v_estado IN ('CERRADO', 'PUBLICADO') THEN
    RAISE EXCEPTION 'REGISTRO_CERRADO: el registro de notas está cerrado y no puede modificarse directamente'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_calificacion_item_registro_cerrado
  BEFORE INSERT OR UPDATE OR DELETE ON calificacion_item
  FOR EACH ROW EXECUTE FUNCTION fn_calificacion_item_registro_cerrado();
