// GET /api/v1/comunidad/personas?dni= · Persona registrada con ese DNI y sus perfiles, o null (D-07, AD-07) · Solo Administrador
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { buscarPersonaPorDni, esquemasComunidad } from "@/modules/comunidad";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const { dni } = esquemasComunidad.ConsultaPersonaSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await buscarPersonaPorDni(dni));
});
