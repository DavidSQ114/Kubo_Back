-- Kubo · Jornada por defecto de los horarios (US27). El parámetro general BLOQUES_HORARIO solo lo cargaba el seed,
-- que no se ejecuta en los despliegues (AWS y Neon solo corren «prisma migrate deploy»): sin él la pantalla de
-- horarios responde JORNADA_NO_CONFIGURADA. Esta migración lo carga si falta; no toca un valor ya registrado.
-- Un parámetro puede no tener usuario: lo cargó el Sistema. Si ya existe un administrador, queda a su nombre.

-- AlterTable
ALTER TABLE "parametro_institucion" ALTER COLUMN "actualizado_por_id" DROP NOT NULL;

INSERT INTO parametro_institucion (clave, valor, descripcion, actualizado_por_id)
VALUES (
  'BLOQUES_HORARIO',
  '[
    {"orden": 1, "horaInicio": "07:45", "horaFin": "08:30", "tipo": "CLASE", "etiqueta": "1.ª hora"},
    {"orden": 2, "horaInicio": "08:30", "horaFin": "09:15", "tipo": "CLASE", "etiqueta": "2.ª hora"},
    {"orden": 3, "horaInicio": "09:15", "horaFin": "10:00", "tipo": "CLASE", "etiqueta": "3.ª hora"},
    {"orden": 4, "horaInicio": "10:00", "horaFin": "10:20", "tipo": "RECREO", "etiqueta": "Recreo"},
    {"orden": 5, "horaInicio": "10:20", "horaFin": "11:05", "tipo": "CLASE", "etiqueta": "4.ª hora"},
    {"orden": 6, "horaInicio": "11:05", "horaFin": "11:50", "tipo": "CLASE", "etiqueta": "5.ª hora"},
    {"orden": 7, "horaInicio": "11:50", "horaFin": "12:35", "tipo": "CLASE", "etiqueta": "6.ª hora"},
    {"orden": 8, "horaInicio": "12:35", "horaFin": "13:20", "tipo": "CLASE", "etiqueta": "7.ª hora"}
  ]'::jsonb,
  'Bloques horarios por defecto de la jornada escolar (orden, horas y tipo CLASE o RECREO)',
  -- el administrador más antiguo, si ya hay alguno; en una base recién creada todavía no existe: NULL
  (SELECT u.id FROM usuario u JOIN administrador a ON a.persona_id = u.persona_id ORDER BY u.created_at LIMIT 1)
)
ON CONFLICT (clave) WHERE anio_academico_id IS NULL DO NOTHING;
