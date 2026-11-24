// aula-virtual/application: notificación interna (tipo MATERIAL, US55) a los alumnos con cuenta de la sección cuando
// el docente publica un material (US61) o un enlace de clase virtual (US62). Solo notificación de la campana, sin
// correo. Los destinatarios se preparan antes de la transacción; si la consulta falla, la publicación sigue sin aviso.
import type { MetaSolicitud } from "@/platform/http/ruta";
import { logger } from "@/platform/logger";
import type { AvisoInterno } from "@/platform/notificaciones";
import { fechaEnLima } from "@/modules/academico";
import { apoderadosDeEstudiantes } from "@/modules/comunidad";
import { usuariosDePersonas } from "@/modules/identidad";
import { datosDeMatriculas, matriculasDeSeccionEnFecha } from "@/modules/matricula";

/** Cuentas de los alumnos matriculados hoy (MATRICULADO) en la sección; [] si la consulta falla. */
export async function cuentasDeAlumnos(seccionId: string, meta: MetaSolicitud, ahora = new Date()): Promise<string[]> {
  try {
    const ids = await matriculasDeSeccionEnFecha(seccionId, fechaEnLima(ahora));
    const vigentes = Object.values(await datosDeMatriculas(ids)).filter((m) => m.estado === "MATRICULADO");
    const estudiantes = await apoderadosDeEstudiantes(vigentes.map((m) => m.estudianteId));
    const personas = Object.values(estudiantes).map((e) => e.personaId);
    return Object.values(await usuariosDePersonas(personas));
  } catch (e) {
    logger.warn("No se pudo preparar el aviso del aula virtual para los alumnos", {
      requestId: meta.requestId,
      error: (e as Error).message,
    });
    return [];
  }
}

/** Notificaciones MATERIAL con el enlace al curso en «Mis cursos» del alumno (AL-05). */
export function avisosDePublicacion(
  usuarioIds: string[],
  contenido: { titulo: string; mensaje: string; cursoId: string },
): AvisoInterno[] {
  return usuarioIds.map((usuarioId) => ({
    usuarioId,
    tipo: "MATERIAL",
    titulo: contenido.titulo,
    mensaje: contenido.mensaje,
    enlace: `/alumno/cursos/${contenido.cursoId}`,
  }));
}
