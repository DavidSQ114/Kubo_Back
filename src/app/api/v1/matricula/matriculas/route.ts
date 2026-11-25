// GET  /api/v1/matricula/matriculas?anioId= · Matrículas del año con filtros y búsqueda (US18, AD-10) · Solo Coordinador académico
// POST /api/v1/matricula/matriculas · Matricular en sección y generar el cronograma (US18, US21, AD-10) · Solo Coordinador académico
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { confirmarMatricula, esquemasMatricula, listarMatriculas, ROLES_MATRICULA } from "@/modules/matricula";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ROLES_MATRICULA.GESTION });
  const filtro = esquemasMatricula.FiltroMatriculasSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await listarMatriculas(filtro));
});

export const POST = ruta(async (req, { meta }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_MATRICULA.GESTION });
  const datos = await leerCuerpo(req, esquemasMatricula.MatricularSchema);
  return ok(await confirmarMatricula(coordinador, datos, meta), 201);
});
