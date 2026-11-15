-- Kubo · Horarios (US27–US31): cuadrícula por sección, asignación de clases, cruces de docente y de aula, y
-- publicación por versiones.
-- - bloque_horario pasa a ser el catálogo del año (orden, horas y tipo CLASE o RECREO); el día va en cada clase.
-- - en_vigor: la clase ocupa a su docente y a su aula mientras su horario es BORRADOR o PUBLICADO (antes, solo
--   PUBLICADO). Los cruces entre secciones los impiden dos restricciones de exclusión, también en borrador.
-- - Un solo horario BORRADOR por sección.
-- Las tablas de horarios no tenían uso antes de este sprint. Si tuvieran filas, la migración se detiene sin
-- cambiar nada para no perder datos.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM bloque_horario) OR EXISTS (SELECT 1 FROM horario) THEN
    RAISE EXCEPTION 'MIGRACION_HORARIOS: hay bloques u horarios registrados con el modelo anterior; revísalos antes de migrar';
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "TipoBloque" AS ENUM ('CLASE', 'RECREO');

-- DropIndex
DROP INDEX "bloque_horario_dia_hora_inicio_key";

-- DropIndex
DROP INDEX "detalle_horario_horario_id_bloque_id_key";

-- Cruces del modelo anterior (por bloque con día y solo al publicar): los reemplazan las exclusiones de abajo
DROP INDEX uq_detalle_bloque_aula;
DROP INDEX uq_detalle_bloque_docente;
DROP INDEX uq_detalle_bloque_seccion;

-- AlterTable
ALTER TABLE "bloque_horario" DROP COLUMN "activo",
DROP COLUMN "dia",
DROP COLUMN "obligatorio",
ADD COLUMN     "anio_academico_id" UUID NOT NULL,
ADD COLUMN     "orden" INTEGER NOT NULL,
ADD COLUMN     "tipo" "TipoBloque" NOT NULL DEFAULT 'CLASE';

-- AlterTable
ALTER TABLE "detalle_horario" ADD COLUMN     "dia" "DiaSemana" NOT NULL,
ALTER COLUMN "en_vigor" SET DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "bloque_horario_anio_academico_id_orden_key" ON "bloque_horario"("anio_academico_id", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "bloque_horario_anio_academico_id_hora_inicio_key" ON "bloque_horario"("anio_academico_id", "hora_inicio");

-- CreateIndex
CREATE INDEX "detalle_horario_docente_id_idx" ON "detalle_horario"("docente_id");

-- CreateIndex
CREATE UNIQUE INDEX "detalle_horario_horario_id_dia_bloque_id_key" ON "detalle_horario"("horario_id", "dia", "bloque_id");

-- AddForeignKey
ALTER TABLE "bloque_horario" ADD CONSTRAINT "bloque_horario_anio_academico_id_fkey" FOREIGN KEY ("anio_academico_id") REFERENCES "anio_academico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================================
-- Restricciones que Prisma no expresa
-- =====================================================================

ALTER TABLE bloque_horario ADD CONSTRAINT ck_bloque_orden CHECK (orden >= 1);

-- Un solo horario BORRADOR por sección (US31: editar el publicado crea un único borrador)
CREATE UNIQUE INDEX uq_horario_borrador_por_seccion
  ON horario (seccion_id)
  WHERE estado_publicacion = 'BORRADOR';

-- Sin cruces de docente ni de aula entre secciones (US29, US30): en el mismo día y bloque, un docente o un aula
-- solo pueden estar en una sección. El borrador y la versión publicada de una misma sección sí repiten sus clases.
-- btree_gist aporta la igualdad de uuid y de enumeraciones en índices GiST (extensión de confianza de PostgreSQL).
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE detalle_horario ADD CONSTRAINT uq_detalle_cruce_docente
  EXCLUDE USING gist (dia WITH =, bloque_id WITH =, docente_id WITH =, seccion_id WITH <>)
  WHERE (en_vigor);

ALTER TABLE detalle_horario ADD CONSTRAINT uq_detalle_cruce_aula
  EXCLUDE USING gist (dia WITH =, bloque_id WITH =, aula_id WITH =, seccion_id WITH <>)
  WHERE (en_vigor);

-- La clase copia sección y docente de su asignación, usa un bloque de clase del año de su sección y nace
-- ocupando docente y aula si su horario no está archivado (RF23)
CREATE OR REPLACE FUNCTION fn_detalle_horario_coherente() RETURNS trigger AS $$
DECLARE a RECORD; h RECORD; b RECORD;
BEGIN
  SELECT seccion_id, docente_id INTO a FROM asignacion_docente WHERE id = NEW.asignacion_docente_id;
  SELECT ho.seccion_id, ho.estado_publicacion, s.anio_academico_id INTO h
    FROM horario ho JOIN seccion s ON s.id = ho.seccion_id WHERE ho.id = NEW.horario_id;
  SELECT anio_academico_id, tipo INTO b FROM bloque_horario WHERE id = NEW.bloque_id;
  IF NEW.seccion_id <> a.seccion_id OR NEW.docente_id <> a.docente_id OR NEW.seccion_id <> h.seccion_id THEN
    RAISE EXCEPTION 'DETALLE_INCOHERENTE: sección o docente no coinciden con la asignación y el horario'
      USING ERRCODE = 'P0001';
  END IF;
  IF b.anio_academico_id <> h.anio_academico_id OR b.tipo <> 'CLASE' THEN
    RAISE EXCEPTION 'DETALLE_INCOHERENTE: el bloque no es de clase o no pertenece al año de la sección'
      USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.en_vigor := (h.estado_publicacion <> 'ARCHIVADO');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER tg_detalle_horario_coherente ON detalle_horario;
CREATE TRIGGER tg_detalle_horario_coherente
  BEFORE INSERT OR UPDATE OF asignacion_docente_id, seccion_id, docente_id, horario_id, bloque_id ON detalle_horario
  FOR EACH ROW EXECUTE FUNCTION fn_detalle_horario_coherente();

-- en_vigor sigue al estado del horario: al archivar una versión, sus clases dejan de ocupar docente y aula
CREATE OR REPLACE FUNCTION fn_horario_en_vigor() RETURNS trigger AS $$
BEGIN
  IF NEW.estado_publicacion IS DISTINCT FROM OLD.estado_publicacion THEN
    UPDATE detalle_horario SET en_vigor = (NEW.estado_publicacion <> 'ARCHIVADO'), updated_at = CURRENT_TIMESTAMP
     WHERE horario_id = NEW.id AND en_vigor IS DISTINCT FROM (NEW.estado_publicacion <> 'ARCHIVADO');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
