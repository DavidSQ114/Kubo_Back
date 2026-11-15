// GET /api/v1/horarios/secciones/{id}/publicado · Horario publicado de la sección, sin el borrador en edición
// (US31, RF24; base de los portales) · Administrador y Docente
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasHorarios, horarioPublicadoDeSeccion } from "@/modules/horarios";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR", "DOCENTE"] });
  return ok(await horarioPublicadoDeSeccion(esquemasHorarios.IdSchema.parse(params.id)));
});
