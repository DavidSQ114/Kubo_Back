// GET /api/v1/matricula/morosidad · Panel de morosidad (US24, AD-12) · Solo Administrador
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasMatricula, panelMorosidad } from "@/modules/matricula";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const filtro = esquemasMatricula.FiltroMorosidadSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await panelMorosidad(filtro));
});
