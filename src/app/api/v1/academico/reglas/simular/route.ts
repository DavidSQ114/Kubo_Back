// POST /api/v1/academico/reglas/simular · Vista previa del cálculo con logros de ejemplo (US12, AD-05) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasAcademico, simularConsolidacion } from "@/modules/academico";

export const POST = ruta(async (req) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const datos = await leerCuerpo(req, esquemasAcademico.SimulacionSchema);
  return ok(simularConsolidacion(datos));
});
