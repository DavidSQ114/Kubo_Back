// DELETE /api/v1/academico/asignaciones/{id} · Quitar asignación: se desactiva si tiene notas u horarios (US14) · Solo Coordinador académico
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasAcademico, quitarAsignacion, ROLES_ACADEMICO } from "@/modules/academico";

export const DELETE = ruta(async (req, { meta, params }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_ACADEMICO.GESTION });
  return ok(await quitarAsignacion(coordinador, esquemasAcademico.IdSchema.parse(params.id), meta));
});
