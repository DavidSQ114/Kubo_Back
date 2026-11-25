// GET /api/v1/horarios/secciones/{id}?version= · Cuadrícula semanal de la sección: 5 días por los bloques del año,
// con las clases del borrador en edición o de la versión publicada (US27, RF22, AD-13) · Solo Coordinador académico
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasHorarios, obtenerCuadricula, ROLES_HORARIOS } from "@/modules/horarios";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ROLES_HORARIOS.GESTION });
  const seccionId = esquemasHorarios.IdSchema.parse(params.id);
  const consulta = Object.fromEntries(new URL(req.url).searchParams);
  const { version } = esquemasHorarios.ConsultaVersionSchema.parse(consulta);
  return ok(await obtenerCuadricula(seccionId, version));
});
