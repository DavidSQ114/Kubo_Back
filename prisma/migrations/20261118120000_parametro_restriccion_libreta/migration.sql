-- Kubo · Restricción de la libreta de notas por deuda (US26).
-- Carga el parámetro PENSIONES_VENCIDAS_RESTRINGEN_LIBRETA si falta: con esa cantidad de pensiones vencidas (2) el
-- apoderado no ve la libreta. Solo lo cargaba el seed, que no se ejecuta en los despliegues; no toca un valor ya
-- registrado. Mismo valor y descripción que prisma/seed.sql.
INSERT INTO parametro_institucion (clave, valor, descripcion, actualizado_por_id)
SELECT v.clave, v.valor::jsonb, v.descripcion,
       -- el administrador más antiguo, si ya hay alguno; en una base recién creada todavía no existe: NULL
       (SELECT u.id FROM usuario u JOIN administrador a ON a.persona_id = u.persona_id ORDER BY u.created_at LIMIT 1)
FROM (VALUES
  ('PENSIONES_VENCIDAS_RESTRINGEN_LIBRETA', '2', 'Pensiones vencidas a partir de las que el apoderado no ve la libreta de notas (US26)')
) AS v(clave, valor, descripcion)
ON CONFLICT (clave) WHERE anio_academico_id IS NULL DO NOTHING;
