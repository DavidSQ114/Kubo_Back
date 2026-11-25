// GET /api/v1/horarios/tutoria/{seccionId}/sesiones/{sesionId} · Una sesión de la sección con su lista de alumnos,
// editable por el tutor dentro del bimestre en curso (bloque M3) · Docente tutor o cotutor de la sección
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { ROLES_ACADEMICO } from "@/modules/academico";
import { esquemasHorarios, sesionDeTutoria } from "@/modules/horarios";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req, { params }) => {
  const docente = await requerirSesion(req, { roles: ROLES_ACADEMICO.TUTORIA });
  const seccionId = esquemasHorarios.IdSchema.parse(params.seccionId);
  const sesionId = esquemasHorarios.IdSchema.parse(params.sesionId);
  return ok(await sesionDeTutoria(docente, seccionId, sesionId));
});
