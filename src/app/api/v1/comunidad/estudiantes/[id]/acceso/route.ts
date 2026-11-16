// POST /api/v1/comunidad/estudiantes/{id}/acceso · Crear acceso al portal del alumno: cuenta con contraseña temporal
// y cambio obligatorio en el primer ingreso (US49, RF43, AD-06) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta, urlBase } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { crearAccesoAlumno, esquemasComunidad } from "@/modules/comunidad";

export const POST = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const estudianteId = esquemasComunidad.IdPersonaSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasComunidad.CrearAccesoAlumnoSchema);
  return ok(await crearAccesoAlumno(admin, estudianteId, datos, urlBase(req), meta), 201);
});
