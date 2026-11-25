// evaluacion/application: piezas comunes de las pantallas de notas de la tutoría (bloque M3): el bimestre elegido del
// año de la tutoría y los alumnos de la sección. La guardia tutoriaDelDocente la aplica cada caso de uso.
import { fechaEnLima, obtenerAnio, type TutoriaDelDocente } from "@/modules/academico";
import { resumenEstudiantes } from "@/modules/comunidad";
import { datosDeMatriculas, matriculasDeSeccionEnFecha } from "@/modules/matricula";
import { erroresTutoriaNotas as E } from "../domain/errores";

export interface PeriodoDeTutoria {
  id: string;
  numero: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
}

/**
 * Bimestres del año de la tutoría y el elegido: el pedido o, por defecto, el que contiene hoy; en vacaciones, el
 * último que empezó; antes del año, el primero. 404 si el pedido es de otro año.
 */
export async function periodosDeTutoria(t: TutoriaDelDocente, periodoId: string | undefined, ahora: Date) {
  const anio = await obtenerAnio(t.anio.id);
  const periodos: PeriodoDeTutoria[] = [...anio.periodos]
    .sort((a, b) => a.numero - b.numero)
    .map(({ id, numero, nombre, fechaInicio, fechaFin, estado }) => ({
      id,
      numero,
      nombre,
      fechaInicio,
      fechaFin,
      estado,
    }));
  const hoy = fechaEnLima(ahora);
  const porDefecto =
    periodos.find((p) => p.fechaInicio <= hoy && hoy <= p.fechaFin) ??
    periodos.filter((p) => p.fechaInicio <= hoy).at(-1) ??
    periodos[0];
  const elegido = periodoId ? periodos.find((p) => p.id === periodoId) : porDefecto;
  if (!elegido) throw E.periodoDeOtroAnio();
  return { periodos, elegido, hoy };
}

export interface AlumnoDeLaTutoria {
  matriculaId: string;
  estudianteId: string;
  /** «Álvarez Torres, Camila». */
  nombre: string;
}

/**
 * Alumnos con matrícula vigente en la sección en el bimestre: a la fecha de hoy si cae en él, si no a su último día
 * (o al primero, si aún no empieza). Ordenados por apellido.
 */
export async function alumnosDeLaTutoria(
  seccionId: string,
  periodo: Pick<PeriodoDeTutoria, "fechaInicio" | "fechaFin">,
  hoy: string,
): Promise<AlumnoDeLaTutoria[]> {
  const corte = hoy < periodo.fechaInicio ? periodo.fechaInicio : hoy > periodo.fechaFin ? periodo.fechaFin : hoy;
  const ids = await matriculasDeSeccionEnFecha(seccionId, corte);
  const datos = Object.values(await datosDeMatriculas(ids)).filter((m) => m.estado === "MATRICULADO");
  const estudiantes = await resumenEstudiantes(datos.map((m) => m.estudianteId));
  return datos
    .flatMap((m) => {
      const e = estudiantes[m.estudianteId];
      return e
        ? [{ matriculaId: m.matriculaId, estudianteId: m.estudianteId, nombre: `${e.apellidos}, ${e.nombres}` }]
        : [];
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
