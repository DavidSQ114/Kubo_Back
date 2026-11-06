// GET /api/v1/matricula/apoderado/hijos/{id}/cuotas/{cuotaId}/comprobante · Comprobante de una cuota pagada (US44)
// Solo Apoderado · 403 si el estudiante no es su hijo; 422 RECIBO_NO_CONFIRMADO si la cuota no está «Pagado».
import "@/server/wiring";
import { pdf, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { comprobanteDeCuota, esquemasMatricula } from "@/modules/matricula";

export const GET = ruta(async (req, { meta, params }) => {
  const apoderado = await requerirSesion(req, { roles: ["APODERADO"] });
  const estudianteId = esquemasMatricula.IdSchema.parse(params.id);
  const cuotaId = esquemasMatricula.IdSchema.parse(params.cuotaId);
  const r = await comprobanteDeCuota(apoderado, estudianteId, cuotaId, meta);
  return pdf(r.bytes, r.nombreArchivo);
});
