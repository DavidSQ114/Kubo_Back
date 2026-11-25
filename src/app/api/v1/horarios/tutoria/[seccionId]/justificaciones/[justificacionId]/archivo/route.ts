// GET /api/v1/horarios/tutoria/{seccionId}/justificaciones/{justificacionId}/archivo · Archivo adjunto de una
// justificación de la sección (PDF o JPG, inline) (bloque M3) · Docente tutor o cotutor de la sección
import "@/server/wiring";
import { respuestaArchivo } from "@/platform/archivos";
import { ruta } from "@/platform/http/ruta";
import { ROLES_ACADEMICO } from "@/modules/academico";
import { archivoDeJustificacion, esquemasHorarios } from "@/modules/horarios";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req, { params }) => {
  const docente = await requerirSesion(req, { roles: ROLES_ACADEMICO.TUTORIA });
  const seccionId = esquemasHorarios.IdSchema.parse(params.seccionId);
  const id = esquemasHorarios.IdSchema.parse(params.justificacionId);
  const { flujo, archivo } = await archivoDeJustificacion(docente, seccionId, id);
  return respuestaArchivo(flujo, archivo);
});
