// GET /api/v1/academico/mis-cursos/{id}/competencias · Competencias de mi curso: las del plan de su curso y grado, las
// del área que puede agregar y las secciones del grado (bloque M2, DO-04) · Solo Docente (solo sus cursos)
// PUT /api/v1/academico/mis-cursos/{id}/competencias · Agregar o quitar competencias del plan de su curso y grado, con
// su peso, mientras ninguna tenga notas en el año (bloque M2, DO-04) · Solo Docente (solo sus cursos)
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { competenciasDeMiCurso, esquemasAcademico, guardarCompetenciasDeMiCurso } from "@/modules/academico";

export const GET = ruta(async (req, { params }) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  return ok(await competenciasDeMiCurso(docente, esquemasAcademico.IdSchema.parse(params.id)));
});

export const PUT = ruta(async (req, { meta, params }) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  const asignacionId = esquemasAcademico.IdSchema.parse(params.id);
  const { competencias } = await leerCuerpo(req, esquemasAcademico.CompetenciasPlanSchema);
  return ok(await guardarCompetenciasDeMiCurso(docente, asignacionId, competencias, meta));
});
