// POST /api/v1/identidad/usuarios/{id}/suspender · Suspender acceso (RF05, M-04) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { esquemasIdentidad, requerirSesion, suspenderUsuario } from "@/modules/identidad";

export const POST = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const usuarioId = esquemasIdentidad.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasIdentidad.SuspensionSchema);
  return ok(await suspenderUsuario(admin, usuarioId, datos, meta));
});
