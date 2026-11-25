// GET /api/v1/horarios/tutoria/{seccionId}/clases?fecha= · Clases de la sección en un día del bimestre en curso,
// según el horario publicado, con su sesión si ya se abrió (bloque M3) · Docente tutor o cotutor de la sección
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { ROLES_ACADEMICO } from "@/modules/academico";
import { clasesDelDiaDeTutoria, esquemasHorarios } from "@/modules/horarios";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req, { params }) => {
  const docente = await requerirSesion(req, { roles: ROLES_ACADEMICO.TUTORIA });
  const seccionId = esquemasHorarios.IdSchema.parse(params.seccionId);
  const consulta = esquemasHorarios.ConsultaClasesTutoriaSchema.parse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  return ok(await clasesDelDiaDeTutoria(docente, seccionId, consulta));
});
