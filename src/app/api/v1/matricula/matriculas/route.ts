// GET  /api/v1/matricula/matriculas?anioId= · Matrículas del año con filtros y búsqueda (US18, AD-10) · Solo Administrador
// POST /api/v1/matricula/matriculas · Matricular en sección y generar el cronograma (US18, US21, AD-10) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { confirmarMatricula, esquemasMatricula, listarMatriculas } from "@/modules/matricula";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const filtro = esquemasMatricula.FiltroMatriculasSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await listarMatriculas(filtro));
});

export const POST = ruta(async (req, { meta }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const datos = await leerCuerpo(req, esquemasMatricula.MatricularSchema);
  return ok(await confirmarMatricula(admin, datos, meta), 201);
});
