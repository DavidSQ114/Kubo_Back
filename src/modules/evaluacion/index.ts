// evaluacion: interfaz pública. Registro de notas cualitativas del docente (US37), cierre y consolidación del
// bimestre (US39), bloqueo del registro cerrado (US40) y el puerto que usa académico (cierres del año y notas por
// competencia).
export { cierresProviderEvaluacion } from "./infrastructure/cierresProvider";
export { LOGROS_NOTA, ESTADOS_REGISTRO, MENSAJE_CORRECCION, type LogroNota, type EstadoRegistro } from "./domain/notas";
export {
  MENSAJE_VALOR_NO_PERMITIDO,
  MENSAJE_PERIODO_NO_ACTIVO,
  MENSAJE_REGISTRO_CERRADO,
  MENSAJE_NOTAS_INCOMPLETAS,
  type Pendiente,
} from "./domain/errores";
export {
  misRegistros,
  registroDeNotas,
  guardarNotas,
  cerrarRegistro,
  type MisRegistros,
  type RegistroDeNotas,
  type NotasGuardadas,
  type RegistroCerrado,
  type AvisoCierre,
} from "./application/registroNotas";
export * as esquemasEvaluacion from "./schemas";
