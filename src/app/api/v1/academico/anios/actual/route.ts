// GET /api/v1/academico/anios/actual · Situación del año por defecto para la barra superior · Cualquier rol con sesión
// Ejemplo de respuesta: { anio: 2026, estado: "EN_CURSO", detalle: "Bimestre IV en curso", etiqueta: "Año 2026 · …" }
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { situacionActual } from "@/modules/academico";

export const GET = ruta(async (req) => {
  await requerirSesion(req);
  return ok(await situacionActual());
});
