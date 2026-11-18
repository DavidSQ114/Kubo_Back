// POST /api/v1/evaluacion/registros/{asignacionId}/bimestres/{periodoId}/rectificaciones · Solicitar rectificación de
// una nota de un registro CERRADO o PUBLICADO: queda «Pendiente de aprobación» y se avisa por correo a los
// administradores (US41, M-08) · Solo Docente (solo sus cursos)
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { esquemasEvaluacion, solicitarRectificacion } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const POST = ruta(async (req, { meta, params }) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  const { asignacionId, periodoId } = esquemasEvaluacion.RegistroParamsSchema.parse(params);
  const datos = await leerCuerpo(req, esquemasEvaluacion.SolicitarRectificacionSchema);
  return ok(await solicitarRectificacion(docente, asignacionId, periodoId, datos, meta), 201);
});
