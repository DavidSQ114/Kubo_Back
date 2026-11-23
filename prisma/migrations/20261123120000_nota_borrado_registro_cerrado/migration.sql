-- D-15: un registro de notas CERRADO o PUBLICADO tampoco admite borrar notas. tg_nota_registro_cerrado (US40, US41)
-- solo cubre INSERT y UPDATE; este trigger agrega BEFORE DELETE ON nota con el mismo mensaje, que ruta() convierte en
-- un error 422 legible. Sin excepción para las rectificaciones: una rectificación aprobada actualiza la nota, no la
-- borra. Borrar el cierre completo arrastra sus notas por la cascada de nota_cierre_id_fkey: en ese momento la fila
-- del cierre ya no existe y el trigger lo deja pasar (ningún flujo de la aplicación borra cierres de calificación).

CREATE OR REPLACE FUNCTION fn_nota_borrado_registro_cerrado() RETURNS trigger AS $$
DECLARE
  v_estado "EstadoCierre";
BEGIN
  SELECT estado INTO v_estado FROM cierre_calificacion WHERE id = OLD.cierre_id;
  IF v_estado IN ('CERRADO', 'PUBLICADO') THEN
    RAISE EXCEPTION 'REGISTRO_CERRADO: el registro de notas está cerrado y no puede modificarse directamente'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_nota_borrado_registro_cerrado
  BEFORE DELETE ON nota
  FOR EACH ROW EXECUTE FUNCTION fn_nota_borrado_registro_cerrado();
