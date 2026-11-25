// GET /api/v1/matricula/solicitudes?anioId=&estado= · Bandeja de solicitudes de matrícula del año (bloque M4) · Solo Coordinador académico
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { bandejaSolicitudes, esquemasMatricula, ROLES_MATRICULA } from "@/modules/matricula";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ROLES_MATRICULA.GESTION });
  const filtro = esquemasMatricula.FiltroSolicitudesSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await bandejaSolicitudes(filtro));
});
