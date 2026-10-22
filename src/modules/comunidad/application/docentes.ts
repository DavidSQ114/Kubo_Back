// comunidad/application: docentes para elegir tutor de sección (US08, AD-03).
import type { DocenteResumen } from "@/modules/academico";
import { docentes } from "../infrastructure/repositorio";

type FilaDocente = Awaited<ReturnType<typeof docentes.activos>>[number];

/** «Mónica Torres Aguilar» → nombreCorto «M. Torres» (inicial y primer apellido). */
export function resumenDocente(d: FilaDocente): DocenteResumen {
  const { nombres, apellidos } = d.persona;
  return {
    id: d.id,
    nombreCompleto: `${nombres} ${apellidos}`,
    nombreCorto: `${nombres.charAt(0)}. ${apellidos.split(" ")[0]}`,
    activo: d.activo && d.persona.activo,
  };
}

export async function listarDocentesActivos(): Promise<DocenteResumen[]> {
  return (await docentes.activos()).map(resumenDocente);
}
