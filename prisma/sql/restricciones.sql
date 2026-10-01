-- =====================================================================
-- Kubo · Restricciones que Prisma no puede expresar en el schema
-- Diagrama de clases v4.2 · Requisitos v4.2
-- Se agrega como migración propia: prisma/migrations/<fecha>_restricciones/migration.sql
-- =====================================================================

-- ---------------------------------------------------------------
-- 1. Índices únicos parciales
-- ---------------------------------------------------------------

-- Una sola matrícula EN_PROCESO o MATRICULADO por estudiante y año (RF14)
CREATE UNIQUE INDEX uq_matricula_activa_por_anio
  ON matricula (estudiante_id, anio_academico_id)
  WHERE estado IN ('EN_PROCESO', 'MATRICULADO');

-- Un solo horario PUBLICADO por sección (RF24)
CREATE UNIQUE INDEX uq_horario_publicado_por_seccion
  ON horario (seccion_id)
  WHERE estado_publicacion = 'PUBLICADO';

-- Sin cruces en los horarios en vigor (RF23): aula, docente y sección
-- en_vigor = true solo en los detalles del horario PUBLICADO de cada sección.
CREATE UNIQUE INDEX uq_detalle_bloque_aula
  ON detalle_horario (bloque_id, aula_id) WHERE en_vigor;
CREATE UNIQUE INDEX uq_detalle_bloque_docente
  ON detalle_horario (bloque_id, docente_id) WHERE en_vigor;
CREATE UNIQUE INDEX uq_detalle_bloque_seccion
  ON detalle_horario (bloque_id, seccion_id) WHERE en_vigor;

-- Un solo docente activo por curso del plan y sección (RF11)
CREATE UNIQUE INDEX uq_asignacion_activa
  ON asignacion_docente (plan_estudio_id, seccion_id)
  WHERE activo;

-- Máximo una solicitud abierta por nota (RF31)
CREATE UNIQUE INDEX uq_solicitud_abierta_por_nota
  ON solicitud_rectificacion (nota_id)
  WHERE estado IN ('PENDIENTE', 'EN_REVISION');

-- Una sola regla VIGENTE por año (RF10)
CREATE UNIQUE INDEX uq_regla_vigente_por_anio
  ON regla_consolidacion (anio_academico_id)
  WHERE estado = 'VIGENTE';

-- Una sola cuota de matrícula por matrícula (mes vacío): el UNIQUE normal no cubre los NULL
CREATE UNIQUE INDEX uq_concepto_matricula_sin_mes
  ON concepto_cobro (matricula_id, tipo)
  WHERE mes IS NULL;

-- Parámetros generales (sin año) no se repiten
CREATE UNIQUE INDEX uq_parametro_general
  ON parametro_institucion (clave)
  WHERE anio_academico_id IS NULL;

-- Un solo año en curso
CREATE UNIQUE INDEX uq_anio_en_curso
  ON anio_academico (estado)
  WHERE estado = 'EN_CURSO';

-- ---------------------------------------------------------------
-- 2. Restricciones CHECK
-- ---------------------------------------------------------------

-- Matrícula: sección y responsable obligatorios fuera de EN_PROCESO (RF14, v4.2)
ALTER TABLE matricula ADD CONSTRAINT ck_matricula_confirmada_completa
  CHECK (estado = 'EN_PROCESO' OR (seccion_id IS NOT NULL AND vinculo_responsable_id IS NOT NULL));
ALTER TABLE matricula ADD CONSTRAINT ck_matricula_retiro
  CHECK (estado <> 'RETIRADO' OR (retirado_en IS NOT NULL AND motivo_retiro IS NOT NULL));
ALTER TABLE matricula ADD CONSTRAINT ck_matricula_anulacion
  CHECK (estado <> 'ANULADO' OR (anulado_en IS NOT NULL AND motivo_anulacion IS NOT NULL));

-- Catálogos y rangos
ALTER TABLE grado ADD CONSTRAINT ck_grado_numero CHECK (numero BETWEEN 1 AND 5);
ALTER TABLE periodo_evaluacion ADD CONSTRAINT ck_periodo_numero CHECK (numero BETWEEN 1 AND 4);
ALTER TABLE periodo_evaluacion ADD CONSTRAINT ck_periodo_fechas CHECK (fecha_fin > fecha_inicio);
ALTER TABLE anio_academico ADD CONSTRAINT ck_anio_fechas CHECK (fecha_fin > fecha_inicio);
ALTER TABLE aula ADD CONSTRAINT ck_aula_aforo CHECK (aforo > 0);
ALTER TABLE seccion ADD CONSTRAINT ck_seccion_aforo CHECK (aforo_maximo > 0);
ALTER TABLE plan_estudio ADD CONSTRAINT ck_plan_horas CHECK (horas_semanales > 0);
ALTER TABLE competencia_plan ADD CONSTRAINT ck_competencia_plan_peso CHECK (peso IS NULL OR peso > 0);
ALTER TABLE bloque_horario ADD CONSTRAINT ck_bloque_horas CHECK (hora_fin > hora_inicio);
ALTER TABLE horario ADD CONSTRAINT ck_horario_version CHECK (version >= 1);
ALTER TABLE regla_consolidacion ADD CONSTRAINT ck_regla_version CHECK (version >= 1);

-- Cobros y pagos
ALTER TABLE concepto_cobro ADD CONSTRAINT ck_concepto_mes
  CHECK ((tipo = 'PENSION' AND mes IS NOT NULL AND mes BETWEEN 1 AND 12) OR (tipo = 'MATRICULA' AND mes IS NULL));
ALTER TABLE concepto_cobro ADD CONSTRAINT ck_concepto_monto CHECK (monto >= 0);
ALTER TABLE operacion_pago ADD CONSTRAINT ck_operacion_monto CHECK (monto_total > 0);
ALTER TABLE operacion_pago ADD CONSTRAINT ck_operacion_anulacion
  CHECK (estado <> 'ANULADO' OR (anulado_en IS NOT NULL AND motivo_anulacion IS NOT NULL));
ALTER TABLE pago ADD CONSTRAINT ck_pago_monto CHECK (monto_aplicado > 0);
ALTER TABLE comprobante ADD CONSTRAINT ck_comprobante_monto CHECK (monto_total > 0);

-- Archivos: máximo 5 MB (RNF17, RF36, RF39)
ALTER TABLE evidencia_pedagogica ADD CONSTRAINT ck_evidencia_tamano CHECK (tamano_bytes IS NULL OR tamano_bytes <= 5242880);
ALTER TABLE archivo_entrega ADD CONSTRAINT ck_archivo_entrega_tamano CHECK (tamano_bytes > 0 AND tamano_bytes <= 5242880);
ALTER TABLE material_estudio ADD CONSTRAINT ck_material_peso CHECK (peso_mb IS NULL OR peso_mb <= 5);

-- Rectificación: el valor solicitado debe cambiar algo; rechazo con motivo
ALTER TABLE solicitud_rectificacion ADD CONSTRAINT ck_solicitud_valor CHECK (valor_solicitado <> valor_anterior);
ALTER TABLE solicitud_rectificacion ADD CONSTRAINT ck_solicitud_rechazo
  CHECK (estado <> 'RECHAZADA' OR motivo_rechazo IS NOT NULL);

-- Seguridad
ALTER TABLE usuario ADD CONSTRAINT ck_usuario_intentos CHECK (intentos_fallidos >= 0);

-- ---------------------------------------------------------------
-- 3. Triggers (reglas que cruzan tablas)
-- ---------------------------------------------------------------

-- 3.1 Registro de auditoría inmutable (RF03)
CREATE OR REPLACE FUNCTION fn_auditoria_inmutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'REGISTRO_AUDITORIA_INMUTABLE: la bitácora de auditoría no se modifica ni se borra'
    USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_auditoria_inmutable
  BEFORE UPDATE OR DELETE ON registro_auditoria
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria_inmutable();

-- 3.2 Aforo de la sección ≤ aforo del aula
CREATE OR REPLACE FUNCTION fn_seccion_aforo_aula() RETURNS trigger AS $$
DECLARE v_aforo INTEGER;
BEGIN
  IF NEW.aula_id IS NOT NULL THEN
    SELECT aforo INTO v_aforo FROM aula WHERE id = NEW.aula_id;
    IF NEW.aforo_maximo > v_aforo THEN
      RAISE EXCEPTION 'AFORO_EXCEDE_AULA: el aforo de la sección (%) supera el del aula (%)', NEW.aforo_maximo, v_aforo
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_seccion_aforo_aula
  BEFORE INSERT OR UPDATE OF aforo_maximo, aula_id ON seccion
  FOR EACH ROW EXECUTE FUNCTION fn_seccion_aforo_aula();

-- 3.3 El responsable de pago debe ser apoderado del mismo estudiante
CREATE OR REPLACE FUNCTION fn_matricula_vinculo_estudiante() RETURNS trigger AS $$
BEGIN
  IF NEW.vinculo_responsable_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM vinculo_apoderado v
        WHERE v.id = NEW.vinculo_responsable_id AND v.estudiante_id = NEW.estudiante_id) THEN
    RAISE EXCEPTION 'RESPONSABLE_NO_VINCULADO: el apoderado responsable no está vinculado a este estudiante'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_matricula_vinculo_estudiante
  BEFORE INSERT OR UPDATE OF vinculo_responsable_id, estudiante_id ON matricula
  FOR EACH ROW EXECUTE FUNCTION fn_matricula_vinculo_estudiante();

-- 3.4 El detalle de horario copia sección y docente de su asignación (RF23)
CREATE OR REPLACE FUNCTION fn_detalle_horario_coherente() RETURNS trigger AS $$
DECLARE a RECORD; h RECORD;
BEGIN
  SELECT seccion_id, docente_id INTO a FROM asignacion_docente WHERE id = NEW.asignacion_docente_id;
  SELECT seccion_id INTO h FROM horario WHERE id = NEW.horario_id;
  IF NEW.seccion_id <> a.seccion_id OR NEW.docente_id <> a.docente_id OR NEW.seccion_id <> h.seccion_id THEN
    RAISE EXCEPTION 'DETALLE_INCOHERENTE: sección o docente no coinciden con la asignación y el horario'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_detalle_horario_coherente
  BEFORE INSERT OR UPDATE OF asignacion_docente_id, seccion_id, docente_id, horario_id ON detalle_horario
  FOR EACH ROW EXECUTE FUNCTION fn_detalle_horario_coherente();

-- 3.5 en_vigor sigue al estado del horario: al publicar se activa, al archivar se apaga
CREATE OR REPLACE FUNCTION fn_horario_en_vigor() RETURNS trigger AS $$
BEGIN
  IF NEW.estado_publicacion IS DISTINCT FROM OLD.estado_publicacion THEN
    UPDATE detalle_horario SET en_vigor = (NEW.estado_publicacion = 'PUBLICADO'), updated_at = CURRENT_TIMESTAMP
     WHERE horario_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_horario_en_vigor
  AFTER UPDATE OF estado_publicacion ON horario
  FOR EACH ROW EXECUTE FUNCTION fn_horario_en_vigor();
