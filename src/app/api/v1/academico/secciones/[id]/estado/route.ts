// POST /api/v1/academico/secciones/{id}/estado · Activar o inactivar sección (US08) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { cambiarEstadoSeccion, esquemasAcademico } from "@/modules/academico";

export const POST = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const seccionId = esquemasAcademico.IdSchema.parse(params.id);
  const { estado } = await leerCuerpo(req, esquemasAcademico.EstadoSeccionSchema);
  return ok(await cambiarEstadoSeccion(admin, seccionId, estado, meta));
});
