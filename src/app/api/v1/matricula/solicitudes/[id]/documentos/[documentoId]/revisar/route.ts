// POST /api/v1/matricula/solicitudes/{id}/documentos/{documentoId}/revisar · Aprobar u observar (con motivo) un
//      documento de matrícula (bloque M4) · Solo Coordinador académico
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasMatricula, revisarDocumentoSolicitud, ROLES_MATRICULA } from "@/modules/matricula";

export const POST = ruta(async (req, { meta, params }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_MATRICULA.GESTION });
  const solicitudId = esquemasMatricula.IdSchema.parse(params.id);
  const documentoId = esquemasMatricula.IdSchema.parse(params.documentoId);
  const datos = await leerCuerpo(req, esquemasMatricula.RevisionDocumentoSchema);
  return ok(await revisarDocumentoSolicitud(coordinador, solicitudId, documentoId, datos, meta));
});
