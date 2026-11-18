// GET /api/v1/evaluacion/bitacora · Bitácora de notas: cambios por rango de fechas y docente, del más reciente al más
// antiguo, paginados (US03, AD-16 «Cambios de notas») · Solo Administrador
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { esquemasEvaluacion, listarBitacoraNotas } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const filtro = esquemasEvaluacion.FiltroBitacoraSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await listarBitacoraNotas(filtro));
});
