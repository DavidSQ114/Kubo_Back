// POST /api/v1/comunidad/estudiantes/{id}/acceso · Crear acceso al portal del alumno: cuenta con contraseña temporal
// y cambio obligatorio en el primer ingreso (US49, RF43, AD-06) · Administrador y Coordinador académico
import "@/server/wiring";
import { ok, leerCuerpo, ruta, urlBase } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { crearAccesoAlumno, esquemasComunidad, ROLES_COMUNIDAD } from "@/modules/comunidad";

export const POST = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ROLES_COMUNIDAD.ALUMNOS_Y_APODERADOS });
  const estudianteId = esquemasComunidad.IdPersonaSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasComunidad.CrearAccesoAlumnoSchema);
  return ok(await crearAccesoAlumno(admin, estudianteId, datos, urlBase(req), meta), 201);
});
