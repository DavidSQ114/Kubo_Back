// GET /api/v1/salud · Estado de la aplicación y de la base de datos (despliegue en AWS) · Público
// 200 si todo responde; 503 si la base de datos no responde (desplegar.sh vuelve al release anterior).
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { verificarSalud } from "@/platform/salud";

export const GET = ruta(async () => {
  const salud = await verificarSalud();
  return ok(salud, salud.estado === "ok" ? 200 : 503);
});
