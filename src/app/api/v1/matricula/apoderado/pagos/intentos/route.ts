// POST /api/v1/matricula/apoderado/pagos/intentos · Iniciar un pago en línea (US70, AP-02) · Solo Apoderado
// El servidor calcula el monto de las cuotas elegidas, crea el intento (expira en 30 minutos) y devuelve la URL del
// checkout. 403 ESTUDIANTE_NO_VINCULADO si el estudiante no es hijo de la persona en sesión.
import "@/server/wiring";
import { ok, leerCuerpo, ruta, urlBase } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { crearIntentoPago, esquemasMatricula } from "@/modules/matricula";

export const POST = ruta(async (req) => {
  const apoderado = await requerirSesion(req, { roles: ["APODERADO"] });
  const datos = await leerCuerpo(req, esquemasMatricula.IntentoPagoSchema);
  return ok(await crearIntentoPago(apoderado, { ...datos, urlBase: urlBase(req) }), 201);
});
