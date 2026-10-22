// GET /api/v1/academico/cursos/{id}/planes?anioId= · Grados del curso con sus horas en el año (US10, AD-04) · Solo Administrador
// PUT /api/v1/academico/cursos/{id}/planes?anioId= · Reemplazar los grados y horas del curso en el año (US10) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { errores } from "@/platform/http/errores";
import { requerirSesion } from "@/modules/identidad";
import { esquemasAcademico, guardarPlanes, planesDelCurso } from "@/modules/academico";

function anioDeLaConsulta(req: Request): string {
  const { anioId } = esquemasAcademico.ConsultaAnioSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  if (!anioId) throw errores.datosInvalidos({ anioId: "Indica el año académico" });
  return anioId;
}

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const cursoId = esquemasAcademico.IdSchema.parse(params.id);
  return ok(await planesDelCurso(cursoId, anioDeLaConsulta(req)));
});

export const PUT = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const cursoId = esquemasAcademico.IdSchema.parse(params.id);
  const anioId = anioDeLaConsulta(req);
  const { planes } = await leerCuerpo(req, esquemasAcademico.PlanesSchema);
  return ok(await guardarPlanes(admin, cursoId, anioId, planes, meta));
});
