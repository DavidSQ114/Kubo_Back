// GET  /api/v1/comunidad/apoderados?q= · Apoderados por DNI o nombre (US15, US17, AD-08, AD-09) · Administrador y Coordinador académico
// POST /api/v1/comunidad/apoderados · Registrar apoderado, su cuenta y sus vínculos (US15, RF12, AD-08) · Administrador y Coordinador académico
import "@/server/wiring";
import { ok, leerCuerpo, ruta, urlBase } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { buscarApoderados, esquemasComunidad, registrarApoderado, ROLES_COMUNIDAD } from "@/modules/comunidad";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ROLES_COMUNIDAD.ALUMNOS_Y_APODERADOS });
  const filtro = esquemasComunidad.FiltroBusquedaSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await buscarApoderados(filtro));
});

export const POST = ruta(async (req, { meta }) => {
  const admin = await requerirSesion(req, { roles: ROLES_COMUNIDAD.ALUMNOS_Y_APODERADOS });
  const datos = await leerCuerpo(req, esquemasComunidad.RegistrarApoderadoSchema);
  return ok(await registrarApoderado(admin, datos, urlBase(req), meta), 201);
});
