// POST /api/v1/matricula/solicitudes/{id}/asignar-seccion · Asignar la sección y confirmar la matrícula con los
//      documentos obligatorios aprobados (bloque M4, US18, US21) · Solo Coordinador académico
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { asignarSeccionSolicitud, esquemasMatricula, ROLES_MATRICULA } from "@/modules/matricula";

export const POST = ruta(async (req, { meta, params }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_MATRICULA.GESTION });
  const solicitudId = esquemasMatricula.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasMatricula.AsignarSeccionSchema);
  return ok(await asignarSeccionSolicitud(coordinador, solicitudId, datos, meta));
});
