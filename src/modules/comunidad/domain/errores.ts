// comunidad/domain: errores del módulo (US13 registro de docentes, D-07 persona ya registrada).
import { ErrorApp } from "@/platform/http/errores";

export const erroresComunidad = {
  docenteExistente: () => new ErrorApp("DOCENTE_EXISTENTE", "Ya existe un usuario registrado con este DNI", 409),
  personaNoCoincide: (nombre: string) =>
    new ErrorApp("PERSONA_NO_COINCIDE", `El DNI ya pertenece a otra persona (${nombre}). Verifica el DNI.`, 409),
};
