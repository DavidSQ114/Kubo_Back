// POST /api/v1/matricula/matriculas/{id}/anular · Anular matrícula y sus cuotas pendientes (US18, US21, M-19) · Solo Coordinador académico
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { anularMatricula, esquemasMatricula, ROLES_MATRICULA } from "@/modules/matricula";

export const POST = ruta(async (req, { meta, params }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_MATRICULA.GESTION });
  const id = esquemasMatricula.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasMatricula.AnularSchema);
  return ok(await anularMatricula(coordinador, id, datos, meta));
});
