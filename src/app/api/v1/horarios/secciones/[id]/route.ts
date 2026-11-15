// GET /api/v1/horarios/secciones/{id}?version= · Cuadrícula semanal de la sección: 5 días por los bloques del año,
// con las clases del borrador en edición o de la versión publicada (US27, RF22, AD-13) · Solo Administrador
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasHorarios, obtenerCuadricula } from "@/modules/horarios";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const seccionId = esquemasHorarios.IdSchema.parse(params.id);
  const consulta = Object.fromEntries(new URL(req.url).searchParams);
  const { version } = esquemasHorarios.ConsultaVersionSchema.parse(consulta);
  return ok(await obtenerCuadricula(seccionId, version));
});
