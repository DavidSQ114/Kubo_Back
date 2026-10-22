// comunidad/domain: errores del módulo (US13 registro de docentes).
import { ErrorApp } from "@/platform/http/errores";

export const erroresComunidad = {
  docenteExistente: () => new ErrorApp("DOCENTE_EXISTENTE", "Ya existe un usuario registrado con este DNI", 409),
};
