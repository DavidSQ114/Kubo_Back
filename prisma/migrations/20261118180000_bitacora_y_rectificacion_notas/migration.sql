-- Kubo · Bitácora de notas (US03) y solicitud de rectificación de nota (US41).
-- 1) bitacora_nota: una fila por cada nota registrada o cambiada (docente o rectificación aprobada), con quién, cuándo,
--    curso, sección, bimestre, estudiante, competencia, valor anterior y nuevo. Inmutable: el trigger rechaza UPDATE,
--    DELETE y TRUNCATE. Sin claves foráneas: guarda ids y una copia de los nombres (AD-16 en docs/arquitectura).
-- 2) solicitud_rectificacion guarda quién la pidió (la tabla no se usaba hasta ahora: no tiene filas). Una sola
--    solicitud pendiente por nota, valor distinto del registrado y motivo obligatorio al rechazar.
-- 3) tg_nota_registro_cerrado (US40) deja pasar un único camino en un registro CERRADO o PUBLICADO: el cambio de una
--    rectificación ya APROBADA, cuando la transacción lo declara con set_config('kubo.rectificacion_id', <id>, true) y
--    la nota pasa exactamente del valor anterior al solicitado. Cualquier otra escritura sigue rechazada.

-- CreateEnum
CREATE TYPE "OrigenCambioNota" AS ENUM ('REGISTRO', 'RECTIFICACION');

-- AlterTable
ALTER TABLE "solicitud_rectificacion" ADD COLUMN     "solicitado_por_id" UUID NOT NULL;

-- CreateTable
CREATE TABLE "bitacora_nota" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nota_id" UUID NOT NULL,
    "cierre_id" UUID NOT NULL,
    "matricula_id" UUID NOT NULL,
    "competencia_plan_id" UUID NOT NULL,
    "origen" "OrigenCambioNota" NOT NULL,
    "solicitud_id" UUID,
    "logro_anterior" "Logro",
    "logro_nuevo" "Logro" NOT NULL,
    "usuario_id" UUID NOT NULL,
    "usuario_nombre" TEXT NOT NULL,
    "docente_id" UUID NOT NULL,
    "docente_nombre" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "curso_codigo" TEXT NOT NULL,
    "curso_nombre" TEXT NOT NULL,
    "seccion" TEXT NOT NULL,
    "bimestre_numero" INTEGER NOT NULL,
    "bimestre_nombre" TEXT NOT NULL,
    "estudiante_nombre" TEXT NOT NULL,
    "competencia_columna" INTEGER NOT NULL,
    "competencia_codigo" TEXT NOT NULL,
    "competencia_nombre" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bitacora_nota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bitacora_nota_created_at_idx" ON "bitacora_nota"("created_at");

-- CreateIndex
CREATE INDEX "bitacora_nota_docente_id_created_at_idx" ON "bitacora_nota"("docente_id", "created_at");

-- CreateIndex
CREATE INDEX "bitacora_nota_nota_id_idx" ON "bitacora_nota"("nota_id");

-- CreateIndex
CREATE INDEX "solicitud_rectificacion_estado_created_at_idx" ON "solicitud_rectificacion"("estado", "created_at");

-- CreateIndex
CREATE INDEX "solicitud_rectificacion_solicitado_por_id_idx" ON "solicitud_rectificacion"("solicitado_por_id");

-- AddForeignKey
ALTER TABLE "solicitud_rectificacion" ADD CONSTRAINT "solicitud_rectificacion_solicitado_por_id_fkey" FOREIGN KEY ("solicitado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Bitácora de notas inmutable (US03, criterio 3)
CREATE OR REPLACE FUNCTION fn_bitacora_nota_inmutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'BITACORA_NOTA_INMUTABLE: la bitácora de notas no se modifica ni se borra'
    USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_bitacora_nota_inmutable
  BEFORE UPDATE OR DELETE ON bitacora_nota
  FOR EACH ROW EXECUTE FUNCTION fn_bitacora_nota_inmutable();

CREATE TRIGGER tg_bitacora_nota_sin_vaciar
  BEFORE TRUNCATE ON bitacora_nota
  FOR EACH STATEMENT EXECUTE FUNCTION fn_bitacora_nota_inmutable();

-- Solicitud de rectificación (US41)
CREATE UNIQUE INDEX uq_solicitud_rectificacion_pendiente_por_nota
  ON solicitud_rectificacion (nota_id) WHERE estado IN ('PENDIENTE', 'EN_REVISION');

ALTER TABLE solicitud_rectificacion
  ADD CONSTRAINT ck_solicitud_rectificacion_valor_distinto CHECK (valor_solicitado <> valor_anterior),
  ADD CONSTRAINT ck_solicitud_rectificacion_motivo_rechazo CHECK (estado <> 'RECHAZADA' OR motivo_rechazo IS NOT NULL);

-- Registro cerrado: solo lectura salvo una rectificación aprobada (US40, US41)
CREATE OR REPLACE FUNCTION fn_nota_registro_cerrado() RETURNS trigger AS $$
DECLARE
  v_estado "EstadoCierre";
  v_solicitud TEXT;
BEGIN
  SELECT estado INTO v_estado FROM cierre_calificacion WHERE id = NEW.cierre_id;
  IF v_estado IN ('CERRADO', 'PUBLICADO') THEN
    v_solicitud := current_setting('kubo.rectificacion_id', true);
    IF TG_OP = 'UPDATE'
       AND v_solicitud ~ '^[0-9a-fA-F-]{36}$'
       AND NEW.cierre_id = OLD.cierre_id
       AND NEW.matricula_id = OLD.matricula_id
       AND NEW.competencia_plan_id = OLD.competencia_plan_id
       AND EXISTS (
         SELECT 1 FROM solicitud_rectificacion s
         WHERE s.id = v_solicitud::uuid
           AND s.nota_id = NEW.id
           AND s.estado = 'APROBADA'
           AND s.valor_anterior = OLD.logro
           AND s.valor_solicitado = NEW.logro
       ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'REGISTRO_CERRADO: el registro de notas está cerrado y no puede modificarse directamente'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
