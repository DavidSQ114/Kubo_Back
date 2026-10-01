-- =====================================================================
-- Kubo · Datos iniciales (seed). Idempotente: se puede ejecutar varias veces.
-- Catálogo de áreas y competencias de secundaria según el Currículo Nacional (CNEB, MINEDU).
-- IMPORTANTE: cambiar la contraseña del administrador inicial en el primer ingreso (RF43).
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- Grados de secundaria
INSERT INTO grado (numero, nombre) VALUES
  (1, '1° de secundaria'),
  (2, '2° de secundaria'),
  (3, '3° de secundaria'),
  (4, '4° de secundaria'),
  (5, '5° de secundaria')
ON CONFLICT (numero) DO NOTHING;

-- Áreas curriculares
INSERT INTO area_curricular (codigo, nombre) VALUES
  ('DPCC', 'Desarrollo Personal, Ciudadanía y Cívica'),
  ('CCSS', 'Ciencias Sociales'),
  ('EF', 'Educación Física'),
  ('AYC', 'Arte y Cultura'),
  ('COM', 'Comunicación'),
  ('ING', 'Inglés como lengua extranjera'),
  ('MAT', 'Matemática'),
  ('CYT', 'Ciencia y Tecnología'),
  ('ER', 'Educación Religiosa'),
  ('EPT', 'Educación para el Trabajo'),
  ('TRV', 'Competencias transversales')
ON CONFLICT (codigo) DO NOTHING;

-- Competencias (28 de secundaria, incluidas las 2 transversales)
INSERT INTO competencia (area_curricular_id, codigo, nombre)
SELECT a.id, v.codigo, v.nombre FROM (VALUES
  ('DPCC', 'DPCC-C1', 'Construye su identidad'),
  ('DPCC', 'DPCC-C2', 'Convive y participa democráticamente en la búsqueda del bien común'),
  ('CCSS', 'CCSS-C1', 'Construye interpretaciones históricas'),
  ('CCSS', 'CCSS-C2', 'Gestiona responsablemente el espacio y el ambiente'),
  ('CCSS', 'CCSS-C3', 'Gestiona responsablemente los recursos económicos'),
  ('EF', 'EF-C1', 'Se desenvuelve de manera autónoma a través de su motricidad'),
  ('EF', 'EF-C2', 'Asume una vida saludable'),
  ('EF', 'EF-C3', 'Interactúa a través de sus habilidades sociomotrices'),
  ('AYC', 'AYC-C1', 'Aprecia de manera crítica manifestaciones artístico-culturales'),
  ('AYC', 'AYC-C2', 'Crea proyectos desde los lenguajes artísticos'),
  ('COM', 'COM-C1', 'Se comunica oralmente en su lengua materna'),
  ('COM', 'COM-C2', 'Lee diversos tipos de textos escritos en su lengua materna'),
  ('COM', 'COM-C3', 'Escribe diversos tipos de textos en su lengua materna'),
  ('ING', 'ING-C1', 'Se comunica oralmente en inglés como lengua extranjera'),
  ('ING', 'ING-C2', 'Lee diversos tipos de textos escritos en inglés como lengua extranjera'),
  ('ING', 'ING-C3', 'Escribe diversos tipos de textos en inglés como lengua extranjera'),
  ('MAT', 'MAT-C1', 'Resuelve problemas de cantidad'),
  ('MAT', 'MAT-C2', 'Resuelve problemas de regularidad, equivalencia y cambio'),
  ('MAT', 'MAT-C3', 'Resuelve problemas de forma, movimiento y localización'),
  ('MAT', 'MAT-C4', 'Resuelve problemas de gestión de datos e incertidumbre'),
  ('CYT', 'CYT-C1', 'Indaga mediante métodos científicos para construir sus conocimientos'),
  ('CYT', 'CYT-C2', 'Explica el mundo físico basándose en conocimientos sobre los seres vivos, materia y energía, biodiversidad, Tierra y universo'),
  ('CYT', 'CYT-C3', 'Diseña y construye soluciones tecnológicas para resolver problemas de su entorno'),
  ('ER', 'ER-C1', 'Construye su identidad como persona humana, amada por Dios, digna, libre y trascendente, comprendiendo la doctrina de su propia religión, abierto al diálogo con las que le son cercanas'),
  ('ER', 'ER-C2', 'Asume la experiencia del encuentro personal y comunitario con Dios en su proyecto de vida en coherencia con su creencia religiosa'),
  ('EPT', 'EPT-C1', 'Gestiona proyectos de emprendimiento económico o social'),
  ('TRV', 'TRV-C1', 'Se desenvuelve en entornos virtuales generados por las TIC'),
  ('TRV', 'TRV-C2', 'Gestiona su aprendizaje de manera autónoma')
) AS v(area, codigo, nombre)
JOIN area_curricular a ON a.codigo = v.area
ON CONFLICT (codigo) DO NOTHING;

-- Cursos: uno por área (las competencias transversales no tienen curso propio)
INSERT INTO curso (area_curricular_id, codigo, nombre)
SELECT id, codigo, nombre FROM area_curricular WHERE codigo <> 'TRV'
ON CONFLICT (codigo) DO NOTHING;

-- Administrador inicial
INSERT INTO persona (dni, nombres, apellidos, email)
VALUES ('00000000', 'Administrador', 'Kubo', 'admin@kubo.edu.pe')
ON CONFLICT (dni) DO NOTHING;

INSERT INTO administrador (persona_id, cargo)
SELECT id, 'Administrador del sistema' FROM persona WHERE dni = '00000000'
ON CONFLICT (persona_id) DO NOTHING;

INSERT INTO usuario (persona_id, email, password_hash, estado, debe_cambiar_password)
SELECT id, 'admin@kubo.edu.pe', crypt('Kubo#2026', gen_salt('bf', 10)), 'ACTIVO', true
FROM persona WHERE dni = '00000000'
ON CONFLICT (email) DO NOTHING;

-- Parámetros generales (sin año). Ajustar montos antes de abrir la matrícula.
INSERT INTO parametro_institucion (clave, valor, descripcion, actualizado_por_id)
SELECT v.clave, v.valor::jsonb, v.descripcion, u.id FROM (VALUES
  ('MONTO_MATRICULA', '350.00', 'Cuota de matrícula (S/)'),
  ('MONTO_PENSION', '450.00', 'Monto de cada pensión (S/)'),
  ('DIA_VENCIMIENTO', '5', 'Día del mes en que vence cada pensión'),
  ('MAX_INTENTOS_LOGIN', '5', 'Intentos fallidos antes del bloqueo'),
  ('MINUTOS_BLOQUEO', '15', 'Minutos de bloqueo tras superar los intentos'),
  ('HORA_LIMITE_DOCENTE', '"08:00"', 'Hora límite de marcación docente'),
  ('UMBRAL_INASISTENCIA', '0.20', 'Porcentaje anual de faltas que activa la alerta de riesgo (RF54)'),
  ('UMBRAL_INASISTENCIA_AVISO', '0.15', 'Porcentaje anual de faltas que activa el aviso previo (RF54)'),
  ('UMBRAL_FALTAS_MES', '3', 'Faltas injustificadas en un mes que activan la alerta mensual (RF54)'),
  ('PLAZO_CORRECCION_ASISTENCIA_H', '24', 'Horas que tiene el docente para corregir la asistencia')
) AS v(clave, valor, descripcion)
CROSS JOIN (SELECT id FROM usuario WHERE email = 'admin@kubo.edu.pe') u
ON CONFLICT (clave) WHERE anio_academico_id IS NULL DO NOTHING;

COMMIT;
