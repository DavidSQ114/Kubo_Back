// POST /api/v1/comunidad/administradores · Registrar un administrador y su cuenta (RF43, RF46) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta, urlBase } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasComunidad, registrarAdministrador } from "@/modules/comunidad";

export const POST = ruta(async (req, { meta }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const datos = await leerCuerpo(req, esquemasComunidad.RegistrarAdministradorSchema);
  return ok(await registrarAdministrador(admin, datos, urlBase(req), meta), 201);
});
