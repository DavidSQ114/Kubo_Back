// GET /api/v1/horarios/tutoria/{seccionId}/inicio · Inicio de «Mi tutoría»: la sección, sus alumnos, las faltas de
// hoy y los alumnos con aviso por umbral (bloque M3) · Docente tutor o cotutor de la sección (403 NO_ES_TUTOR)
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { ROLES_ACADEMICO } from "@/modules/academico";
import { esquemasHorarios, inicioDeTutoria } from "@/modules/horarios";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req, { params }) => {
  const docente = await requerirSesion(req, { roles: ROLES_ACADEMICO.TUTORIA });
  const seccionId = esquemasHorarios.IdSchema.parse(params.seccionId);
  return ok(await inicioDeTutoria(docente, seccionId));
});
