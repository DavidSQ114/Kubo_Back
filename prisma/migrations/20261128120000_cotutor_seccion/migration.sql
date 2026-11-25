-- Bloque M3 · Tutor y cotutor de la sección. El cotutor es opcional y tiene los mismos permisos que el tutor.

-- AlterTable
ALTER TABLE "seccion" ADD COLUMN     "cotutor_id" UUID;

-- AddForeignKey
ALTER TABLE "seccion" ADD CONSTRAINT "seccion_cotutor_id_fkey" FOREIGN KEY ("cotutor_id") REFERENCES "docente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- El tutor y el cotutor no pueden ser el mismo docente
ALTER TABLE "seccion" ADD CONSTRAINT "ck_seccion_cotutor_distinto"
  CHECK (tutor_id IS NULL OR cotutor_id IS NULL OR tutor_id <> cotutor_id);

-- Un docente es tutor o cotutor de una sola sección por año académico. La aplicación lo valida antes con un mensaje
-- claro; el trigger cubre dos asignaciones simultáneas.
CREATE OR REPLACE FUNCTION fn_seccion_tutoria_unica() RETURNS trigger AS $$
DECLARE v_docente UUID;
BEGIN
  FOREACH v_docente IN ARRAY ARRAY[NEW.tutor_id, NEW.cotutor_id] LOOP
    IF v_docente IS NOT NULL AND EXISTS (
         SELECT 1 FROM seccion s
          WHERE s.anio_academico_id = NEW.anio_academico_id
            AND s.id <> NEW.id
            AND (s.tutor_id = v_docente OR s.cotutor_id = v_docente)) THEN
      RAISE EXCEPTION 'DOCENTE_YA_ES_TUTOR: el docente ya es tutor o cotutor de otra sección del año'
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_seccion_tutoria_unica
  BEFORE INSERT OR UPDATE OF tutor_id, cotutor_id, anio_academico_id ON seccion
  FOR EACH ROW EXECUTE FUNCTION fn_seccion_tutoria_unica();
