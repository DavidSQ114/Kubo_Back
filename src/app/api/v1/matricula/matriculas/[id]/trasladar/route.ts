// POST /api/v1/matricula/matriculas/{id}/trasladar · Traslado de sección (US19, M-05) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasMatricula, trasladarMatricula } from "@/modules/matricula";

export const POST = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const id = esquemasMatricula.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasMatricula.TrasladoSchema);
  return ok(await trasladarMatricula(admin, id, datos, meta));
});
