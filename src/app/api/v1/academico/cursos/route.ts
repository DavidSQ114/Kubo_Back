// GET  /api/v1/academico/cursos?areaId=&estado=&anioId= · Cursos con sus grados del año (US10, AD-04) · Solo Coordinador académico
// POST /api/v1/academico/cursos · Registrar curso y, opcionalmente, su plan del año (US10, US11) · Solo Coordinador académico
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { crearCurso, esquemasAcademico, listarCursos, ROLES_ACADEMICO } from "@/modules/academico";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ROLES_ACADEMICO.GESTION });
  const filtro = esquemasAcademico.ConsultaCursosSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await listarCursos(filtro));
});

export const POST = ruta(async (req, { meta }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_ACADEMICO.GESTION });
  const datos = await leerCuerpo(req, esquemasAcademico.CursoSchema);
  return ok(await crearCurso(coordinador, datos, meta), 201);
});
