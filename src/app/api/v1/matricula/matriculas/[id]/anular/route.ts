// POST /api/v1/matricula/matriculas/{id}/anular · Anular matrícula y sus cuotas pendientes (US18, US21, M-19) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { anularMatricula, esquemasMatricula } from "@/modules/matricula";

export const POST = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const id = esquemasMatricula.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasMatricula.AnularSchema);
  return ok(await anularMatricula(admin, id, datos, meta));
});
