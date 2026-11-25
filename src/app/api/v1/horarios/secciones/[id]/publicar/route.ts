// POST /api/v1/horarios/secciones/{id}/publicar · Publicar el horario: la versión anterior se archiva y se avisa
// por correo a los docentes de la sección (US31, RF24, AD-13) · Solo Coordinador académico
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasHorarios, publicarHorario, ROLES_HORARIOS } from "@/modules/horarios";

export const POST = ruta(async (req, { meta, params }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_HORARIOS.GESTION });
  return ok(await publicarHorario(coordinador, esquemasHorarios.IdSchema.parse(params.id), meta));
});
