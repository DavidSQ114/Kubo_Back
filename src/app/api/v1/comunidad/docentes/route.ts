// GET  /api/v1/comunidad/docentes · Docentes activos para elegir tutor o asignar cursos (US08, US14) · Administrador y Coordinador académico (lectura)
// POST /api/v1/comunidad/docentes · Registrar docente y su cuenta (US13, RF11, AD-07) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta, urlBase } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasComunidad, listarDocentesActivos, registrarDocente, ROLES_COMUNIDAD } from "@/modules/comunidad";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ROLES_COMUNIDAD.CONSULTA });
  return ok(await listarDocentesActivos());
});

export const POST = ruta(async (req, { meta }) => {
  const admin = await requerirSesion(req, { roles: ROLES_COMUNIDAD.USUARIOS });
  const datos = await leerCuerpo(req, esquemasComunidad.RegistrarDocenteSchema);
  return ok(await registrarDocente(admin, datos, urlBase(req), meta), 201);
});
