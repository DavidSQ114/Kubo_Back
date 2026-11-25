// GET /api/v1/identidad/errores/{id} · Detalle de un error con su stack trace (US05, AD-16) · Solo Administrador
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { detalleErrorSistema, esquemasIdentidad, requerirSesion, ROLES_IDENTIDAD } from "@/modules/identidad";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ROLES_IDENTIDAD.AUDITORIA });
  return ok(await detalleErrorSistema(esquemasIdentidad.IdLogSchema.parse(params.id)));
});
