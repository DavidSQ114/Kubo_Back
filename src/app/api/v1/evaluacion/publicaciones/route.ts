// GET  /api/v1/evaluacion/publicaciones · Registros por publicar (CERRADOS) y publicados del año, por bimestre, grado,
//      sección y curso (US39, AD-15) · Solo Administrador
// POST /api/v1/evaluacion/publicaciones · Publicar notas: CERRADO → PUBLICADO, auditoría PUBLICAR_NOTAS y aviso por
//      correo a los apoderados vinculados (US39, criterio 4) · Solo Administrador
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { esquemasEvaluacion, publicarNotas, registrosParaPublicar } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const filtro = esquemasEvaluacion.FiltroPublicacionSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await registrosParaPublicar(filtro));
});

export const POST = ruta(async (req, { meta }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const { cierreIds } = await leerCuerpo(req, esquemasEvaluacion.PublicarNotasSchema);
  return ok(await publicarNotas(admin, cierreIds, meta));
});
