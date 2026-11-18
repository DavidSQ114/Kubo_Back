// GET /api/v1/evaluacion/alumno/libreta/pdf?periodoId= · «Descargar libreta» del alumno en sesión (US66, AL-03)
// · Solo Alumno · 422 LIBRETA_SIN_PUBLICAR sin cursos publicados en el bimestre.
import "@/server/wiring";
import { pdf, ruta } from "@/platform/http/ruta";
import { esquemasEvaluacion, libretaPdfDelAlumno } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req) => {
  const alumno = await requerirSesion(req, { roles: ["ALUMNO"] });
  const { periodoId } = esquemasEvaluacion.LibretaPdfSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const r = await libretaPdfDelAlumno(alumno, periodoId);
  return pdf(r.bytes, r.nombreArchivo);
});
