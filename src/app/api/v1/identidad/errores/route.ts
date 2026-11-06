// GET /api/v1/identidad/errores · Log de errores del sistema (US05, AD-16) · Solo Administrador, solo lectura
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { esquemasIdentidad, listarErroresSistema, requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const filtro = esquemasIdentidad.FiltroErroresSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await listarErroresSistema(filtro));
});
