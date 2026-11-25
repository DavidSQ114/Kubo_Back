// POST /api/v1/academico/anios/{id}/estado · Avanzar el estado del año (US06: abrir matrícula … cerrar) · Solo Coordinador académico
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { cambiarEstadoAnio, esquemasAcademico, ROLES_ACADEMICO } from "@/modules/academico";

export const POST = ruta(async (req, { meta, params }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_ACADEMICO.GESTION });
  const anioId = esquemasAcademico.IdSchema.parse(params.id);
  const { estado } = await leerCuerpo(req, esquemasAcademico.CambioEstadoSchema);
  return ok(await cambiarEstadoAnio(coordinador, anioId, estado, meta));
});
