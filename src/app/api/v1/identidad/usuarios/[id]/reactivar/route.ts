// POST /api/v1/identidad/usuarios/{id}/reactivar · Reactivar acceso (RF05) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { esquemasIdentidad, reactivarUsuario, requerirSesion } from "@/modules/identidad";

export const POST = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const usuarioId = esquemasIdentidad.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasIdentidad.ReactivacionSchema);
  return ok(await reactivarUsuario(admin, usuarioId, datos, meta));
});
