// GET  /api/v1/comunidad/apoderados?q= · Apoderados por DNI o nombre (US15, US17, AD-08, AD-09) · Solo Administrador
// POST /api/v1/comunidad/apoderados · Registrar apoderado, su cuenta y sus vínculos (US15, RF12, AD-08) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta, urlBase } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { buscarApoderados, esquemasComunidad, registrarApoderado } from "@/modules/comunidad";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const filtro = esquemasComunidad.FiltroBusquedaSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await buscarApoderados(filtro));
});

export const POST = ruta(async (req, { meta }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const datos = await leerCuerpo(req, esquemasComunidad.RegistrarApoderadoSchema);
  return ok(await registrarApoderado(admin, datos, urlBase(req), meta), 201);
});
