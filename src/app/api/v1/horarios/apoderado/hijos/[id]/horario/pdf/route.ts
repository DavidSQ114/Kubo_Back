// GET /api/v1/horarios/apoderado/hijos/{id}/horario/pdf · «Descargar PDF» del horario publicado vigente del hijo
// (US66, AP-05) · Solo Apoderado · 403 ESTUDIANTE_NO_VINCULADO si no es su hijo; 422 HORARIO_NO_PUBLICADO.
import "@/server/wiring";
import { pdf, ruta } from "@/platform/http/ruta";
import { esquemasHorarios, horarioPdfDelHijo } from "@/modules/horarios";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req, { params }) => {
  const apoderado = await requerirSesion(req, { roles: ["APODERADO"] });
  const r = await horarioPdfDelHijo(apoderado, esquemasHorarios.IdSchema.parse(params.id));
  return pdf(r.bytes, r.nombreArchivo);
});
