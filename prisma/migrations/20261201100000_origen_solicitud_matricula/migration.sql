-- Documentos de la matrícula presencial: la matrícula directa de un alumno nuevo en «Matrícula» registra sus
-- documentos del proceso del año como una solicitud PRESENCIAL ya resuelta. Las existentes son EN_LINEA.
-- CreateEnum
CREATE TYPE "OrigenSolicitudMatricula" AS ENUM ('EN_LINEA', 'PRESENCIAL');

-- AlterTable
ALTER TABLE "solicitud_matricula" ADD COLUMN     "origen" "OrigenSolicitudMatricula" NOT NULL DEFAULT 'EN_LINEA';

-- Una solicitud presencial nace Matriculada (sus documentos ya se revisaron en secretaría) y solo puede anularse con
-- su matrícula: nunca pasa por la bandeja de revisión.
ALTER TABLE "solicitud_matricula" ADD CONSTRAINT "ck_solicitud_matricula_presencial_resuelta"
  CHECK (origen <> 'PRESENCIAL' OR estado IN ('MATRICULADA', 'ANULADA'));
