// POST /api/v1/academico/aulas/{id}/estado · Activar o desactivar aula (US09: no se borran) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { cambiarEstadoAula, esquemasAcademico } from "@/modules/academico";

export const POST = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const aulaId = esquemasAcademico.IdSchema.parse(params.id);
  const { activo } = await leerCuerpo(req, esquemasAcademico.EstadoAulaSchema);
  return ok(await cambiarEstadoAula(admin, aulaId, activo, meta));
});
