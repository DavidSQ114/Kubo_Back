// academico/application: tutoría de sección (bloque M3). El tutor no es un rol de inicio de sesión: es un docente que
// es tutor o cotutor de una sección del año en curso. Su portal muestra «Mi tutoría» y cada ruta de la tutoría pasa
// por la guardia tutoriaDelDocente (403 NO_ES_TUTOR si no es tutor ni cotutor de esa sección).
import { errores } from "@/platform/http/errores";
import type { Autenticado } from "@/modules/identidad";
import { erroresAcademico as E } from "../domain/errores";
import { rolDeTutoria, type RolTutoria } from "../domain/secciones";
import { anios, secciones, type SeccionFila } from "../infrastructure/repositorio";
import { docentesProvider, type DocenteResumen } from "../puertos";

export interface TutoriaDelDocente {
  /** Docente en sesión. */
  docente: DocenteResumen;
  rol: RolTutoria;
  seccion: {
    id: string;
    nombre: string;
    /** «3° B». */
    etiqueta: string;
    grado: { id: string; numero: number; nombre: string };
    tutorId: string | null;
    cotutorId: string | null;
  };
  anio: { id: string; anio: number };
}

const etiqueta = (s: Pick<SeccionFila, "nombre" | "grado">) => `${s.grado.numero}° ${s.nombre}`;

const vista = (docente: DocenteResumen, rol: RolTutoria, s: SeccionFila, anio: number): TutoriaDelDocente => ({
  docente,
  rol,
  seccion: {
    id: s.id,
    nombre: s.nombre,
    etiqueta: etiqueta(s),
    grado: s.grado,
    tutorId: s.tutorId,
    cotutorId: s.cotutorId,
  },
  anio: { id: s.anioAcademicoId, anio },
});

async function docenteEnSesion(auth: Autenticado): Promise<DocenteResumen | null> {
  if (auth.rol !== "DOCENTE") return null;
  const d = await docentesProvider().docentePorPersona(auth.personaId);
  return d && d.activo ? d : null;
}

/** Año académico EN_CURSO (a lo más uno, uq_anio_en_curso); null si no hay. */
async function anioEnCurso() {
  return (await anios.listar()).find((a) => a.estado === "EN_CURSO") ?? null;
}

/**
 * Guardia de toda ruta de la tutoría: el docente en sesión debe ser tutor o cotutor de la sección, y la sección debe
 * ser del año en curso. Si no, 403 NO_ES_TUTOR (también si la sección no existe: no se revela cuáles existen).
 * Ejemplo en un caso de uso: `const t = await tutoriaDelDocente(auth, seccionId);`.
 */
export async function tutoriaDelDocente(auth: Autenticado, seccionId: string): Promise<TutoriaDelDocente> {
  const docente = await docenteEnSesion(auth);
  if (!docente) throw E.noEsTutor();
  const [s, anio] = await Promise.all([secciones.porId(seccionId), anioEnCurso()]);
  if (!s || !anio || s.anioAcademicoId !== anio.id) throw E.noEsTutor();
  const rol = rolDeTutoria(s, docente.id);
  if (!rol) throw E.noEsTutor();
  return vista(docente, rol, s, anio.anio);
}

/**
 * Tutorías del docente en sesión en el año en curso (a lo más una por la regla del bloque M3). Vacía si no es tutor
 * ni cotutor: el portal no muestra «Mi tutoría».
 */
export async function misTutorias(auth: Autenticado): Promise<TutoriaDelDocente[]> {
  const docente = await docenteEnSesion(auth);
  if (!docente) throw errores.accesoDenegado();
  const anio = await anioEnCurso();
  if (!anio) return [];
  const filas = await secciones.deTutor(docente.id, anio.id);
  return filas.map((s) => vista(docente, rolDeTutoria(s, docente.id)!, s, anio.anio));
}
