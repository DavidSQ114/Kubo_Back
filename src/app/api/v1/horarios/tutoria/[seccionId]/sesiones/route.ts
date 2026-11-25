// POST /api/v1/horarios/tutoria/{seccionId}/sesiones · Abrir (o reutilizar) la sesión de una clase de la sección en
// una fecha del bimestre en curso; la sesión queda a nombre del docente de la clase (bloque M3) · Docente tutor o
// cotutor de la sección
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { ROLES_ACADEMICO } from "@/modules/academico";
import { abrirClaseDeTutoria, esquemasHorarios } from "@/modules/horarios";
import { requerirSesion } from "@/modules/identidad";

export const POST = ruta(async (req, { params }) => {
  const docente = await requerirSesion(req, { roles: ROLES_ACADEMICO.TUTORIA });
  const seccionId = esquemasHorarios.IdSchema.parse(params.seccionId);
  const datos = await leerCuerpo(req, esquemasHorarios.AbrirClaseTutoriaSchema);
  return ok(await abrirClaseDeTutoria(docente, seccionId, datos), 201);
});
