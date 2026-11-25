// POST /api/v1/comunidad/coordinadores · Registrar un coordinador académico y su cuenta (RF43, RF46, bloque M1)
// · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta, urlBase } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasComunidad, registrarCoordinador } from "@/modules/comunidad";

export const POST = ruta(async (req, { meta }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const datos = await leerCuerpo(req, esquemasComunidad.RegistrarCoordinadorSchema);
  return ok(await registrarCoordinador(admin, datos, urlBase(req), meta), 201);
});
