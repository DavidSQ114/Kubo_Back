-- Kubo · Permite anular una matrícula «En proceso» que aún no tiene sección ni responsable de pago (M-19, US18).
-- La restricción original solo eximía a EN_PROCESO, así que anular un borrador de US17 violaba el CHECK.
-- Compatible con la versión anterior: solo relaja la regla para ANULADO; ninguna fila existente deja de cumplirla.
ALTER TABLE matricula DROP CONSTRAINT ck_matricula_confirmada_completa;
ALTER TABLE matricula ADD CONSTRAINT ck_matricula_confirmada_completa
  CHECK (estado IN ('EN_PROCESO', 'ANULADO') OR (seccion_id IS NOT NULL AND vinculo_responsable_id IS NOT NULL));
