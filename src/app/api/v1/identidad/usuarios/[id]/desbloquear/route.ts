// POST /api/v1/identidad/usuarios/{id}/desbloquear · Desbloquear una cuenta bloqueada por intentos fallidos (RF01,
// AD-06, bloque M1) · Solo Administrador · 409 USUARIO_NO_BLOQUEADO si no está bloqueada
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { desbloquearUsuario, esquemasIdentidad, requerirSesion, ROLES_IDENTIDAD } from "@/modules/identidad";

export const POST = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ROLES_IDENTIDAD.CUENTAS });
  const usuarioId = esquemasIdentidad.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasIdentidad.DesbloqueoSchema);
  return ok(await desbloquearUsuario(admin, usuarioId, datos, meta));
});
