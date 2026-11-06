// comunidad/domain: errores del módulo (US13 docentes, D-07 persona ya registrada, US15 apoderados, US17 estudiantes).
import { ErrorApp } from "@/platform/http/errores";

export const erroresComunidad = {
  docenteExistente: () => new ErrorApp("DOCENTE_EXISTENTE", "Ya existe un usuario registrado con este DNI", 409),
  personaNoCoincide: (nombre: string) =>
    new ErrorApp("PERSONA_NO_COINCIDE", `El DNI ya pertenece a otra persona (${nombre}). Verifica el DNI.`, 409),
  dniEnUso: () =>
    new ErrorApp("DNI_EN_USO", "Ese DNI se acaba de registrar en otra operación. Vuelve a validar el DNI.", 409),

  // ---------- Apoderados (US15) ----------
  /** La pantalla usa los detalles para ofrecer «Vincular a un estudiante» en lugar de crear un duplicado. */
  apoderadoExistente: (detalles: { apoderadoId: string; nombreCompleto: string; estudiantes: number }) =>
    new ErrorApp("APODERADO_EXISTENTE", "Ya existe un apoderado registrado con este DNI", 409, detalles),
  apoderadoNoEncontrado: () =>
    new ErrorApp("APODERADO_NO_ENCONTRADO", "El apoderado no existe o ya no está activo.", 404),

  // ---------- Estudiantes y vínculos (US17) ----------
  estudianteExistente: () =>
    new ErrorApp("ESTUDIANTE_EXISTENTE", "Ya existe un estudiante registrado con este DNI", 409),
  estudianteNoEncontrado: () =>
    new ErrorApp("ESTUDIANTE_NO_ENCONTRADO", "El estudiante no existe o ya no está activo.", 404),
  sinApoderado: () => new ErrorApp("SIN_APODERADO", "Debe asociar al menos un apoderado antes de continuar", 422),
  principalInvalido: () => new ErrorApp("PRINCIPAL_INVALIDO", "Marca exactamente un apoderado como principal.", 422),
  apoderadoRepetido: () =>
    new ErrorApp("APODERADO_REPETIDO", "El mismo apoderado aparece más de una vez. Quítalo de la lista.", 422),
  estudianteRepetido: () =>
    new ErrorApp("ESTUDIANTE_REPETIDO", "El mismo estudiante aparece más de una vez. Quítalo de la lista.", 422),
  vinculoExistente: () => new ErrorApp("VINCULO_EXISTENTE", "Este apoderado ya está vinculado al estudiante.", 409),
  gradoInvalido: () => new ErrorApp("GRADO_INVALIDO", "El grado de ingreso no existe o no está activo.", 422),
};
