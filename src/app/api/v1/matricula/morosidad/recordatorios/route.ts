// POST /api/v1/matricula/morosidad/recordatorios · Enviar recordatorios de pago (US59, AD-12, M-24) · Solo Administrador
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { enviarRecordatoriosPago, esquemasMatricula } from "@/modules/matricula";

export const POST = ruta(async (req, { meta }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const datos = await leerCuerpo(req, esquemasMatricula.RecordatoriosSchema);
  return ok(await enviarRecordatoriosPago(admin, datos, meta));
});
