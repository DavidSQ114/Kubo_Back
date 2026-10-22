// DELETE /api/v1/academico/asignaciones/{id} · Quitar asignación: se desactiva si tiene notas u horarios (US14) · Solo Administrador
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasAcademico, quitarAsignacion } from "@/modules/academico";

export const DELETE = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  return ok(await quitarAsignacion(admin, esquemasAcademico.IdSchema.parse(params.id), meta));
});
