// GET /api/v1/horarios/apoderado/hijos/{id}/horario · Horario publicado de la sección del hijo, con curso, aula y
// docente (US48, AP-05) · Solo Apoderado · 403 ESTUDIANTE_NO_VINCULADO si el estudiante no es hijo de la persona en
// sesión.
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasHorarios, horarioDelHijo } from "@/modules/horarios";

export const GET = ruta(async (req, { params }) => {
  const apoderado = await requerirSesion(req, { roles: ["APODERADO"] });
  const estudianteId = esquemasHorarios.IdSchema.parse(params.id);
  return ok(await horarioDelHijo(apoderado, estudianteId));
});
