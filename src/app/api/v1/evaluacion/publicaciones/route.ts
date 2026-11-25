// GET  /api/v1/evaluacion/publicaciones · Registros por publicar (CERRADOS) y publicados del año, por bimestre, grado,
//      sección y curso (US39, AD-15) · Solo Coordinador académico
// POST /api/v1/evaluacion/publicaciones · Publicar notas: CERRADO → PUBLICADO, auditoría PUBLICAR_NOTAS y aviso por
//      correo a los apoderados vinculados (US39, criterio 4) · Solo Coordinador académico
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { esquemasEvaluacion, publicarNotas, registrosParaPublicar, ROLES_EVALUACION } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ROLES_EVALUACION.GESTION });
  const filtro = esquemasEvaluacion.FiltroPublicacionSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await registrosParaPublicar(filtro));
});

export const POST = ruta(async (req, { meta }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_EVALUACION.GESTION });
  const { cierreIds } = await leerCuerpo(req, esquemasEvaluacion.PublicarNotasSchema);
  return ok(await publicarNotas(coordinador, cierreIds, meta));
});
