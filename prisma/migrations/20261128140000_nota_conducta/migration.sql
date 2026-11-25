-- Bloque M3 · Nota de conducta por matrícula y bimestre: la registra el tutor mientras el periodo no esté FINALIZADO.

-- CreateTable
CREATE TABLE "nota_conducta" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "matricula_id" UUID NOT NULL,
    "periodo_evaluacion_id" UUID NOT NULL,
    "valor" "Logro" NOT NULL,
    "comentario" TEXT,
    "registrado_por_id" UUID NOT NULL,
    "modificado_por_id" UUID,
    "modificado_en" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nota_conducta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nota_conducta_periodo_evaluacion_id_idx" ON "nota_conducta"("periodo_evaluacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "nota_conducta_matricula_id_periodo_evaluacion_id_key" ON "nota_conducta"("matricula_id", "periodo_evaluacion_id");

-- AddForeignKey
ALTER TABLE "nota_conducta" ADD CONSTRAINT "nota_conducta_matricula_id_fkey" FOREIGN KEY ("matricula_id") REFERENCES "matricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota_conducta" ADD CONSTRAINT "nota_conducta_periodo_evaluacion_id_fkey" FOREIGN KEY ("periodo_evaluacion_id") REFERENCES "periodo_evaluacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota_conducta" ADD CONSTRAINT "nota_conducta_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota_conducta" ADD CONSTRAINT "nota_conducta_modificado_por_id_fkey" FOREIGN KEY ("modificado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- El comentario es opcional y de hasta 500 caracteres
ALTER TABLE "nota_conducta" ADD CONSTRAINT "ck_nota_conducta_comentario"
  CHECK (comentario IS NULL OR char_length(comentario) <= 500);

-- No se registra ni se modifica la conducta de un periodo FINALIZADO. La aplicación lo valida antes con un mensaje
-- claro; el trigger lo garantiza aunque se escriba directo en la base.
CREATE OR REPLACE FUNCTION fn_nota_conducta_periodo_finalizado() RETURNS trigger AS $$
DECLARE v_estado TEXT;
BEGIN
  SELECT estado::text INTO v_estado FROM periodo_evaluacion
   WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.periodo_evaluacion_id ELSE NEW.periodo_evaluacion_id END;
  IF v_estado = 'FINALIZADO' THEN
    RAISE EXCEPTION 'PERIODO_FINALIZADO: el bimestre está finalizado y su conducta ya no se modifica'
      USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_nota_conducta_periodo_finalizado
  BEFORE INSERT OR UPDATE OR DELETE ON nota_conducta
  FOR EACH ROW EXECUTE FUNCTION fn_nota_conducta_periodo_finalizado();
