// POST /api/v1/aula-virtual/asignaciones/{asignacionId}/enlaces · Registrar un enlace de clase virtual (US62, M-17) ·
// Solo Docente (solo su curso y sección del año en curso). Cuerpo: { tipo, titulo, url, inicio, fin, visible }; inicio
// y fin en la hora de Lima («2026-11-24T10:00»). URL no http(s): 400 ENLACE_INVALIDO «Ingresa un enlace válido».
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { crearEnlace, esquemasAulaVirtual } from "@/modules/aula-virtual";
import { requerirSesion } from "@/modules/identidad";

export const POST = ruta(async (req, { meta, params }) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  const { asignacionId } = esquemasAulaVirtual.AsignacionParamsSchema.parse(params);
  const datos = await leerCuerpo(req, esquemasAulaVirtual.EnlaceSchema);
  return ok(await crearEnlace(docente, asignacionId, datos, meta), 201);
});
