-- US38 · Evidencias pedagógicas. El archivo ya no se guarda como URL: va al almacén privado de platform/archivos y aquí
-- queda solo su clave interna (<area>/<uuid>). Se renombra la columna (no se borra) para conservar cualquier dato.
ALTER TABLE "evidencia_pedagogica" RENAME COLUMN "archivo_url" TO "archivo_clave";

CREATE INDEX "evidencia_pedagogica_nota_id_idx" ON "evidencia_pedagogica"("nota_id");
CREATE INDEX "evidencia_pedagogica_entrega_trabajo_id_idx" ON "evidencia_pedagogica"("entrega_trabajo_id");

-- Al menos un comentario (no vacío) o un archivo (US38, criterio 1)
ALTER TABLE evidencia_pedagogica ADD CONSTRAINT ck_evidencia_contenido
  CHECK (btrim(coalesce(comentario, '')) <> '' OR archivo_clave IS NOT NULL);
-- Comentario hasta 1000 caracteres
ALTER TABLE evidencia_pedagogica ADD CONSTRAINT ck_evidencia_comentario_largo
  CHECK (comentario IS NULL OR char_length(comentario) <= 1000);
-- Un archivo siempre lleva su nombre, su tipo y su tamaño (mayor que cero); sin archivo, ninguno de ellos
ALTER TABLE evidencia_pedagogica ADD CONSTRAINT ck_evidencia_archivo_completo
  CHECK (
    (archivo_clave IS NULL AND nombre_archivo IS NULL AND mime_type IS NULL AND tamano_bytes IS NULL)
    OR (archivo_clave IS NOT NULL AND nombre_archivo IS NOT NULL AND mime_type IS NOT NULL AND tamano_bytes > 0)
  );

-- Las evidencias se agregan y eliminan solo con el registro de notas ABIERTO (US38, criterio 3): con el registro
-- CERRADO o PUBLICADO quedan en solo lectura, como sus notas (US40). Mismo mensaje que tg_nota_registro_cerrado, que
-- ruta() convierte en 409 REGISTRO_CERRADO. Si el cierre ya no existe (se borró con su cascada), se deja pasar.
CREATE OR REPLACE FUNCTION fn_evidencia_registro_cerrado() RETURNS trigger AS $$
DECLARE
  v_estado "EstadoCierre";
BEGIN
  SELECT c.estado INTO v_estado
    FROM nota n JOIN cierre_calificacion c ON c.id = n.cierre_id
   WHERE n.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.nota_id ELSE NEW.nota_id END;
  IF v_estado IN ('CERRADO', 'PUBLICADO') THEN
    RAISE EXCEPTION 'REGISTRO_CERRADO: el registro de notas está cerrado y no puede modificarse directamente'
      USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_evidencia_registro_cerrado
  BEFORE INSERT OR DELETE ON evidencia_pedagogica
  FOR EACH ROW EXECUTE FUNCTION fn_evidencia_registro_cerrado();
