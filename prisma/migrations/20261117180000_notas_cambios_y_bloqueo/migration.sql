-- Kubo · Registro de notas y cierre de bimestre (US37, US39, US40).
-- 1) nota guarda el logro que tenía antes del último cambio, quién lo cambió y cuándo (US37). La bitácora completa
--    de cambios es US03.
-- 2) tg_nota_registro_cerrado: ninguna nota se crea ni se cambia en un registro CERRADO o PUBLICADO (US40), aunque
--    la escritura no pase por la aplicación. Borrar sigue permitido (lo hace la cascada al eliminar un cierre).
-- No hace falta cargar parámetros: el registro de notas usa los bimestres del año y la regla de consolidación (US12).

-- AlterTable
ALTER TABLE "nota" ADD COLUMN     "logro_anterior" "Logro",
ADD COLUMN     "modificado_en" TIMESTAMPTZ(3),
ADD COLUMN     "modificado_por_id" UUID;

-- AddForeignKey
ALTER TABLE "nota" ADD CONSTRAINT "nota_modificado_por_id_fkey" FOREIGN KEY ("modificado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Registro cerrado: solo lectura (US40)
CREATE OR REPLACE FUNCTION fn_nota_registro_cerrado() RETURNS trigger AS $$
DECLARE v_estado "EstadoCierre";
BEGIN
  SELECT estado INTO v_estado FROM cierre_calificacion WHERE id = NEW.cierre_id;
  IF v_estado IN ('CERRADO', 'PUBLICADO') THEN
    RAISE EXCEPTION 'REGISTRO_CERRADO: el registro de notas está cerrado y no puede modificarse directamente'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_nota_registro_cerrado
  BEFORE INSERT OR UPDATE ON nota
  FOR EACH ROW EXECUTE FUNCTION fn_nota_registro_cerrado();
