// GET /api/v1/matricula/morosidad · Panel de morosidad (US24, AD-12) · Solo Coordinador académico
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasMatricula, panelMorosidad, ROLES_MATRICULA } from "@/modules/matricula";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ROLES_MATRICULA.GESTION });
  const filtro = esquemasMatricula.FiltroMorosidadSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await panelMorosidad(filtro));
});
