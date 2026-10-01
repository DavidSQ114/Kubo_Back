\set ON_ERROR_STOP 1
CREATE OR REPLACE FUNCTION debe_fallar(nombre text, sentencia text, patron text) RETURNS text AS $$
BEGIN
  EXECUTE sentencia;
  RAISE EXCEPTION 'FALLO DE PRUEBA: "%" debía ser rechazada', nombre;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FALLO DE PRUEBA%' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE '%'||patron||'%' THEN RAISE EXCEPTION 'FALLO DE PRUEBA: "%" falló por otra razón: %', nombre, SQLERRM; END IF;
  RETURN 'OK  ' || nombre;
END; $$ LANGUAGE plpgsql;

BEGIN;
-- datos base
INSERT INTO anio_academico (anio, fecha_inicio, fecha_fin, estado) VALUES (2026,'2026-03-01','2026-12-20','EN_CURSO');
INSERT INTO aula (nombre, aforo) VALUES ('A-101', 30), ('A-102', 30);
INSERT INTO seccion (anio_academico_id, grado_id, aula_id, nombre, aforo_maximo)
  SELECT a.id, g.id, (SELECT id FROM aula WHERE nombre='A-101'), 'A', 30 FROM anio_academico a, grado g WHERE g.numero=1;
INSERT INTO seccion (anio_academico_id, grado_id, nombre, aforo_maximo)
  SELECT a.id, g.id, 'B', 30 FROM anio_academico a, grado g WHERE g.numero=1;
INSERT INTO persona (dni,nombres,apellidos) VALUES ('11111111','Ana','Pérez'),('22222222','Luis','Pérez'),('33333333','Rosa','Díaz'),('44444444','Juan','Ríos'),('55555555','Eva','Soto');
INSERT INTO estudiante (persona_id) SELECT id FROM persona WHERE dni IN ('11111111','33333333');
INSERT INTO apoderado (persona_id) SELECT id FROM persona WHERE dni='22222222';
INSERT INTO docente (persona_id) SELECT id FROM persona WHERE dni IN ('44444444','55555555');
INSERT INTO vinculo_apoderado (estudiante_id, apoderado_id, parentesco)
  SELECT e.id, ap.id, 'Padre' FROM estudiante e JOIN persona p ON p.id=e.persona_id, apoderado ap WHERE p.dni='11111111';
CREATE TEMP VIEW ids AS SELECT
 (SELECT e.id FROM estudiante e JOIN persona p ON p.id=e.persona_id WHERE p.dni='11111111') est1,
 (SELECT e.id FROM estudiante e JOIN persona p ON p.id=e.persona_id WHERE p.dni='33333333') est2,
 (SELECT id FROM vinculo_apoderado LIMIT 1) vin,
 (SELECT id FROM seccion WHERE nombre='A') secA, (SELECT id FROM seccion WHERE nombre='B') secB,
 (SELECT id FROM anio_academico) anio, (SELECT id FROM usuario LIMIT 1) adm,
 (SELECT d.id FROM docente d JOIN persona p ON p.id=d.persona_id WHERE p.dni='44444444') doc1;

-- 1. matrícula EN_PROCESO sin sección ni responsable: permitida
INSERT INTO matricula (estudiante_id, anio_academico_id, registrado_por_id) SELECT est1, anio, adm FROM ids;
SELECT 'OK  borrador EN_PROCESO sin sección ni responsable';
SELECT debe_fallar('confirmar sin sección', $q$UPDATE matricula SET estado='MATRICULADO'$q$, 'ck_matricula_confirmada_completa');
SELECT debe_fallar('segunda matrícula activa mismo año', $q$INSERT INTO matricula (estudiante_id, anio_academico_id, registrado_por_id) SELECT est1, anio, adm FROM ids$q$, 'uq_matricula_activa_por_anio');
SELECT debe_fallar('responsable de otro estudiante', $q$INSERT INTO matricula (estudiante_id, anio_academico_id, registrado_por_id, vinculo_responsable_id) SELECT est2, anio, adm, vin FROM ids$q$, 'RESPONSABLE_NO_VINCULADO');
UPDATE matricula SET seccion_id=(SELECT secA FROM ids), vinculo_responsable_id=(SELECT vin FROM ids), estado='MATRICULADO';
SELECT 'OK  confirmar con sección y responsable';
SELECT debe_fallar('retiro sin motivo', $q$UPDATE matricula SET estado='RETIRADO', retirado_en=now()$q$, 'ck_matricula_retiro');
-- 2. cobros
INSERT INTO concepto_cobro (matricula_id, tipo, concepto, monto, fecha_vencimiento) SELECT id,'MATRICULA','Matrícula 2026',350,'2026-03-05' FROM matricula;
SELECT debe_fallar('segunda cuota de matrícula', $q$INSERT INTO concepto_cobro (matricula_id, tipo, concepto, monto, fecha_vencimiento) SELECT id,'MATRICULA','x',350,'2026-03-05' FROM matricula$q$, 'uq_concepto_matricula_sin_mes');
SELECT debe_fallar('pensión sin mes', $q$INSERT INTO concepto_cobro (matricula_id, tipo, concepto, monto, fecha_vencimiento) SELECT id,'PENSION','x',450,'2026-03-05' FROM matricula$q$, 'ck_concepto_mes');
-- 3. aforo vs aula
SELECT debe_fallar('aforo de sección mayor que el aula', $q$UPDATE seccion SET aforo_maximo=40 WHERE nombre='A'$q$, 'AFORO_EXCEDE_AULA');
-- 4. auditoría inmutable
INSERT INTO registro_auditoria (entidad_afectada, entidad_id, accion) VALUES ('matricula','x','CREAR');
SELECT debe_fallar('modificar auditoría', $q$UPDATE registro_auditoria SET accion='OTRA'$q$, 'REGISTRO_AUDITORIA_INMUTABLE');
SELECT debe_fallar('borrar auditoría', $q$DELETE FROM registro_auditoria$q$, 'REGISTRO_AUDITORIA_INMUTABLE');
-- 5. horarios: cruce de docente entre secciones al publicar
INSERT INTO plan_estudio (anio_academico_id, grado_id, curso_id, horas_semanales) SELECT anio, (SELECT id FROM grado WHERE numero=1), (SELECT id FROM curso WHERE codigo='MAT'), 5 FROM ids;
INSERT INTO asignacion_docente (plan_estudio_id, seccion_id, docente_id) SELECT (SELECT id FROM plan_estudio), s, doc1 FROM ids, unnest(ARRAY[secA, secB]) s;
INSERT INTO bloque_horario (dia, hora_inicio, hora_fin, etiqueta) VALUES ('LUNES','08:00','08:45','1.ª hora');
INSERT INTO horario (seccion_id, version) SELECT s, 1 FROM ids, unnest(ARRAY[secA, secB]) s;
INSERT INTO detalle_horario (horario_id, bloque_id, aula_id, asignacion_docente_id, docente_id, seccion_id)
  SELECT h.id, (SELECT id FROM bloque_horario), (SELECT id FROM aula WHERE nombre = CASE WHEN h.seccion_id=(SELECT secA FROM ids) THEN 'A-101' ELSE 'A-102' END), ad.id, ad.docente_id, ad.seccion_id
  FROM horario h JOIN asignacion_docente ad ON ad.seccion_id=h.seccion_id;
SELECT 'OK  dos borradores con el mismo docente en el mismo bloque (se permite en borrador)';
UPDATE horario SET estado_publicacion='PUBLICADO' WHERE seccion_id=(SELECT secA FROM ids);
SELECT CASE WHEN (SELECT bool_and(en_vigor) FROM detalle_horario d JOIN horario h ON h.id=d.horario_id WHERE h.estado_publicacion='PUBLICADO') THEN 'OK  publicar activa en_vigor' ELSE 'FALLO en_vigor' END;
SELECT debe_fallar('publicar con cruce de docente', $q$UPDATE horario SET estado_publicacion='PUBLICADO' WHERE seccion_id=(SELECT secB FROM ids)$q$, 'uq_detalle_bloque_docente');
SELECT debe_fallar('segundo horario publicado en la sección', $q$INSERT INTO horario (seccion_id, version, estado_publicacion) SELECT secA, 2, 'PUBLICADO' FROM ids$q$, 'uq_horario_publicado_por_seccion');
SELECT debe_fallar('detalle con docente distinto a la asignación', $q$UPDATE detalle_horario SET docente_id=(SELECT d.id FROM docente d JOIN persona p ON p.id=d.persona_id WHERE p.dni='55555555')$q$, 'DETALLE_INCOHERENTE');
-- 6. notificaciones sin duplicados
INSERT INTO notificacion (usuario_id, tipo, titulo, mensaje, clave_deduplicacion) SELECT adm,'ASISTENCIA','3 faltas','x','FALTAS_MES:m1:2026-05' FROM ids ON CONFLICT (clave_deduplicacion) DO NOTHING;
INSERT INTO notificacion (usuario_id, tipo, titulo, mensaje, clave_deduplicacion) SELECT adm,'ASISTENCIA','3 faltas','x','FALTAS_MES:m1:2026-05' FROM ids ON CONFLICT (clave_deduplicacion) DO NOTHING;
SELECT CASE WHEN count(*)=1 THEN 'OK  alerta deduplicada (1 sola fila)' ELSE 'FALLO dedup' END FROM notificacion;
ROLLBACK;
