// GET /api/v1/matricula/procesos/{anioId} · Proceso de matrícula del año: fechas y documentos (bloque M4) · Solo Coordinador académico
// PUT /api/v1/matricula/procesos/{anioId} · Guardar fechas y documentos requeridos (bloque M4) · Solo Coordinador académico
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasMatricula, guardarProceso, procesoDelAnio, ROLES_MATRICULA } from "@/modules/matricula";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ROLES_MATRICULA.GESTION });
  return ok(await procesoDelAnio(esquemasMatricula.IdSchema.parse(params.anioId)));
});

export const PUT = ruta(async (req, { meta, params }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_MATRICULA.GESTION });
  const anioId = esquemasMatricula.IdSchema.parse(params.anioId);
  const datos = await leerCuerpo(req, esquemasMatricula.ProcesoMatriculaSchema);
  return ok(await guardarProceso(coordinador, anioId, datos, meta));
});
