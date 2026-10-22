// POST /api/v1/academico/anios/{id}/estado · Avanzar el estado del año (US06: abrir matrícula … cerrar) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { cambiarEstadoAnio, esquemasAcademico } from "@/modules/academico";

export const POST = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const anioId = esquemasAcademico.IdSchema.parse(params.id);
  const { estado } = await leerCuerpo(req, esquemasAcademico.CambioEstadoSchema);
  return ok(await cambiarEstadoAnio(admin, anioId, estado, meta));
});
