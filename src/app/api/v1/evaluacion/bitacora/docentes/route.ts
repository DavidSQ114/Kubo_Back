// GET /api/v1/evaluacion/bitacora/docentes · Docentes con cambios en la bitácora de notas (filtro «Docente» de AD-16,
// US03) · Solo Administrador
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { docentesDeBitacora } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  return ok(await docentesDeBitacora());
});
