// POST /api/v1/horarios/secciones/{id}/publicar · Publicar el horario: la versión anterior se archiva y se avisa
// por correo a los docentes de la sección (US31, RF24, AD-13) · Solo Administrador
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasHorarios, publicarHorario } from "@/modules/horarios";

export const POST = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  return ok(await publicarHorario(admin, esquemasHorarios.IdSchema.parse(params.id), meta));
});
