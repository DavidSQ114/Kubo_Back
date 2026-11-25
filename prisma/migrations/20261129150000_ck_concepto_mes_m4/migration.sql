-- Bloque M4: el mes de la cuota según su tipo. La pensión lleva su mes; la mora, el de su pensión; la matrícula, la
-- cuota de ingreso y la extraordinaria no llevan mes.
ALTER TABLE concepto_cobro DROP CONSTRAINT ck_concepto_mes;
ALTER TABLE concepto_cobro ADD CONSTRAINT ck_concepto_mes CHECK (
  (tipo = 'PENSION' AND mes IS NOT NULL AND mes BETWEEN 1 AND 12)
  OR (tipo = 'MORA' AND (mes IS NULL OR mes BETWEEN 1 AND 12))
  OR (tipo IN ('MATRICULA', 'INGRESO', 'EXTRAORDINARIA') AND mes IS NULL)
);
