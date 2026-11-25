// POST /api/v1/matricula/morosidad/recordatorios · Enviar recordatorios de pago (US59, AD-12, M-24) · Solo Coordinador académico
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { enviarRecordatoriosPago, esquemasMatricula, ROLES_MATRICULA } from "@/modules/matricula";

export const POST = ruta(async (req, { meta }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_MATRICULA.GESTION });
  const datos = await leerCuerpo(req, esquemasMatricula.RecordatoriosSchema);
  return ok(await enviarRecordatoriosPago(coordinador, datos, meta));
});
