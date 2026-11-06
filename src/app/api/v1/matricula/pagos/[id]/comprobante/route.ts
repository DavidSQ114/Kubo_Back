// GET /api/v1/matricula/pagos/{id}/comprobante · Recibo de pago en PDF (US25, M-03) · Solo Administrador
import "@/server/wiring";
import { pdf, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasMatricula, reciboDePago } from "@/modules/matricula";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const recibo = await reciboDePago(esquemasMatricula.IdSchema.parse(params.id));
  return pdf(recibo.bytes, recibo.nombreArchivo);
});
