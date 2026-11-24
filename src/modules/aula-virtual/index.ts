// aula-virtual: interfaz pública. Aula virtual del docente (DO-05): unidades didácticas, materiales de estudio (US61) y
// enlaces de clase virtual (US62); y aula del alumno en «Mis cursos» (US67, AL-05). Está por encima de academico,
// comunidad, identidad y matricula y los usa por su index.ts. Pendiente: trabajos y entregas.
export {
  TIPOS_FORMATO,
  ESTADOS_VISIBILIDAD,
  TIPOS_ENLACE,
  ESTADOS_ENLACE,
  NOMBRE_TIPO_ENLACE,
  LARGO_MAXIMO_TITULO,
  type TipoFormato,
  type EstadoVisibilidad,
  type TipoEnlace,
  type EstadoEnlace,
} from "./domain/reglas";
export { MENSAJE_ENLACE_INVALIDO, MENSAJE_FORMATO_MATERIAL, MENSAJE_TAMANO_MATERIAL } from "./domain/errores";
export {
  cursosDelAula,
  aulaDelDocente,
  type CursosDelAula,
  type CursoDelAula,
  type AulaDelDocente,
} from "./application/aulaDocente";
export { crearUnidad, editarUnidad, moverUnidad } from "./application/unidades";
export {
  subirMaterial,
  publicarMaterial,
  ocultarMaterial,
  eliminarMaterial,
  archivoDeMaterial,
  type DatosMaterial,
} from "./application/materiales";
export {
  crearEnlace,
  editarEnlace,
  cambiarVisibilidadEnlace,
  eliminarEnlace,
  type DatosEnlace,
} from "./application/enlaces";
export {
  cursoDelAlumnoEnAula,
  type AulaDelCurso,
  type MaterialDelAlumno,
  type EnlaceDelAlumno,
} from "./application/aulaAlumno";
export type { UnidadVista, MaterialVista, EnlaceVista, ArchivoDeMaterial } from "./application/vistas";
export * as esquemasAulaVirtual from "./schemas";
