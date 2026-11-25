// GET /api/v1/matricula/solicitudes/{id} · Detalle de una solicitud: documentos y secciones del grado (bloque M4) · Solo Coordinador académico
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { detalleSolicitud, esquemasMatricula, ROLES_MATRICULA } from "@/modules/matricula";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ROLES_MATRICULA.GESTION });
  return ok(await detalleSolicitud(esquemasMatricula.IdSchema.parse(params.id)));
});
