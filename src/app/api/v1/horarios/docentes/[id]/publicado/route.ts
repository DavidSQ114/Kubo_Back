// GET /api/v1/horarios/docentes/{id}/publicado?anioId= · Clases del docente en los horarios publicados del año
// (US31, RF24; base de «Ver por docente») · Solo Coordinador académico
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasHorarios, horarioPublicadoDeDocente, ROLES_HORARIOS } from "@/modules/horarios";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ROLES_HORARIOS.GESTION });
  const docenteId = esquemasHorarios.IdSchema.parse(params.id);
  const consulta = Object.fromEntries(new URL(req.url).searchParams);
  const { anioId } = esquemasHorarios.ConsultaAnioSchema.parse(consulta);
  return ok(await horarioPublicadoDeDocente(docenteId, anioId));
});
