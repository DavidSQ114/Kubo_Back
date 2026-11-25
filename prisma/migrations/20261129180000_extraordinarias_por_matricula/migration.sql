-- Bloque M4: una matrícula puede tener varias cuotas extraordinarias (de lotes distintos). El índice de 2026-10-01
-- admitía una sola cuota sin mes por tipo; las extraordinarias quedan fuera (las controla
-- uq_concepto_cobro_lote_matricula: una por lote y matrícula).
DROP INDEX uq_concepto_matricula_sin_mes;
CREATE UNIQUE INDEX uq_concepto_matricula_sin_mes
  ON concepto_cobro (matricula_id, tipo)
  WHERE mes IS NULL AND tipo <> 'EXTRAORDINARIA';
