// GET /api/v1/matricula/apoderado/matricula · Matrícula en línea: proceso del año, grados y cada hijo con su
// situación y su solicitud (bloque M4) · Solo Apoderado
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { matriculaEnLinea } from "@/modules/matricula";

export const GET = ruta(async (req) => {
  const apoderado = await requerirSesion(req, { roles: ["APODERADO"] });
  return ok(await matriculaEnLinea(apoderado));
});
