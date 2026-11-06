// GET /api/v1/matricula/apoderado/hijos · Hijos que el apoderado puede consultar (US42, AC-05) · Solo Apoderado
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { leerCookieEstudiante } from "@/platform/auth/cookies";
import { requerirSesion } from "@/modules/identidad";
import { hijosDelApoderado } from "@/modules/matricula";

export const GET = ruta(async (req) => {
  const apoderado = await requerirSesion(req, { roles: ["APODERADO"] });
  return ok(await hijosDelApoderado(apoderado, leerCookieEstudiante(req)));
});
