// GET /api/v1/horarios/secciones/{id}/publicado · Horario publicado de la sección, sin el borrador en edición
// (US31, RF24) · Solo Administrador. Los demás perfiles ven únicamente su horario: el docente por /mi-horario, el
// alumno por /alumno/horario y el apoderado por /apoderado/hijos/{id}/horario (nadie consulta una sección ajena).
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasHorarios, horarioPublicadoDeSeccion } from "@/modules/horarios";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  return ok(await horarioPublicadoDeSeccion(esquemasHorarios.IdSchema.parse(params.id)));
});
