// GET  /api/v1/comunidad/estudiantes?q= · Estudiantes por DNI o nombre (US15, AD-08) · Administrador y Coordinador académico
// POST /api/v1/comunidad/estudiantes · Registrar estudiante con sus apoderados, o como borrador (US17, RF13, AD-09) · Administrador y Coordinador académico
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { buscarEstudiantes, esquemasComunidad, registrarEstudiante, ROLES_COMUNIDAD } from "@/modules/comunidad";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ROLES_COMUNIDAD.ALUMNOS_Y_APODERADOS });
  const filtro = esquemasComunidad.FiltroBusquedaSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await buscarEstudiantes(filtro));
});

export const POST = ruta(async (req, { meta }) => {
  const admin = await requerirSesion(req, { roles: ROLES_COMUNIDAD.ALUMNOS_Y_APODERADOS });
  const datos = await leerCuerpo(req, esquemasComunidad.RegistrarEstudianteSchema);
  return ok(await registrarEstudiante(admin, datos, meta), 201);
});
