// GET /api/v1/matricula/pagos/{id}/comprobante · Recibo de pago en PDF (US25, M-03) · Solo Coordinador académico
import "@/server/wiring";
import { pdf, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasMatricula, reciboDePago, ROLES_MATRICULA } from "@/modules/matricula";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ROLES_MATRICULA.GESTION });
  const recibo = await reciboDePago(esquemasMatricula.IdSchema.parse(params.id));
  return pdf(recibo.bytes, recibo.nombreArchivo);
});
