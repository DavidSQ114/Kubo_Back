// GET  /api/v1/academico/anios · Listar años académicos con sus bimestres (US06, AD-02) · Coordinador académico y Administrador (lectura)
// POST /api/v1/academico/anios · Crear año académico en estado PLANIFICADO (US06) · Solo Coordinador académico
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { crearAnio, esquemasAcademico, listarAnios, ROLES_ACADEMICO } from "@/modules/academico";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ROLES_ACADEMICO.CONSULTA });
  return ok(await listarAnios());
});

export const POST = ruta(async (req, { meta }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_ACADEMICO.GESTION });
  const datos = await leerCuerpo(req, esquemasAcademico.CrearAnioSchema);
  return ok(await crearAnio(coordinador, datos, meta), 201);
});
