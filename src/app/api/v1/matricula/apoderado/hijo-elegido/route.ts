// PUT /api/v1/matricula/apoderado/hijo-elegido · Elegir el hijo a consultar (US42, AC-05) · Solo Apoderado
// Guarda la elección en una cookie httpOnly firmada; 403 si el estudiante no está vinculado.
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { escribirCookieEstudiante } from "@/platform/auth/cookies";
import { requerirSesion } from "@/modules/identidad";
import { elegirHijo, esquemasMatricula } from "@/modules/matricula";

export const PUT = ruta(async (req) => {
  const apoderado = await requerirSesion(req, { roles: ["APODERADO"] });
  const { estudianteId } = await leerCuerpo(req, esquemasMatricula.ElegirHijoSchema);
  const r = await elegirHijo(apoderado, estudianteId);
  const res = ok({ estudianteId: r.estudianteId });
  escribirCookieEstudiante(res, r.token);
  return res;
});
