// GET  /api/v1/horarios/apoderado/hijos/{id}/justificaciones · Faltas y tardanzas del hijo de los últimos 7 días que
//      se pueden justificar y las justificaciones ya enviadas con su estado (bloque M3) · Solo Apoderado
// POST /api/v1/horarios/apoderado/hijos/{id}/justificaciones · Enviar una justificación: multipart/form-data con
//      registroId, motivo (5 a 500 caracteres) y, opcional, archivo PDF o JPG de hasta 5 MB · Solo Apoderado ·
//      403 ESTUDIANTE_NO_VINCULADO si no es su hijo
import "@/server/wiring";
import { archivoDelFormulario, leerFormulario } from "@/platform/archivos";
import { ok, ruta } from "@/platform/http/ruta";
import {
  enviarJustificacion,
  esquemasHorarios,
  justificacionesDelHijo,
  MENSAJE_ARCHIVO_JUSTIFICACION,
} from "@/modules/horarios";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req, { params }) => {
  const apoderado = await requerirSesion(req, { roles: ["APODERADO"] });
  const estudianteId = esquemasHorarios.IdSchema.parse(params.id);
  return ok(await justificacionesDelHijo(apoderado, estudianteId));
});

export const POST = ruta(async (req, { meta, params }) => {
  const apoderado = await requerirSesion(req, { roles: ["APODERADO"] });
  const estudianteId = esquemasHorarios.IdSchema.parse(params.id);
  // rechaza por Content-Length (o mientras lee) un cuerpo de más de 5 MB, antes de leerlo completo
  const formulario = await leerFormulario(req, { mensaje: MENSAJE_ARCHIVO_JUSTIFICACION });
  const campos = esquemasHorarios.JustificacionApoderadoSchema.parse({
    registroId: formulario.get("registroId"),
    motivo: formulario.get("motivo"),
  });
  const archivo = await archivoDelFormulario(formulario, "archivo");
  return ok(await enviarJustificacion(apoderado, estudianteId, { ...campos, archivo }, meta), 201);
});
