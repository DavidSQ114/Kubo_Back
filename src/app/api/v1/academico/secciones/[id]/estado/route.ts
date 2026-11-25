// POST /api/v1/academico/secciones/{id}/estado · Activar o inactivar sección (US08) · Solo Coordinador académico
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { cambiarEstadoSeccion, esquemasAcademico, ROLES_ACADEMICO } from "@/modules/academico";

export const POST = ruta(async (req, { meta, params }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_ACADEMICO.GESTION });
  const seccionId = esquemasAcademico.IdSchema.parse(params.id);
  const { estado } = await leerCuerpo(req, esquemasAcademico.EstadoSeccionSchema);
  return ok(await cambiarEstadoSeccion(coordinador, seccionId, estado, meta));
});
