// GET /api/v1/horarios/apoderado/hijos/{id}/asistencia?mes=AAAA-MM · Resumen mensual de la asistencia del hijo, por
// día, con sus observaciones y alertas (US45, AP-03) · Solo Apoderado · 403 ESTUDIANTE_NO_VINCULADO si el estudiante
// no es hijo de la persona en sesión.
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { asistenciaDelHijo, esquemasHorarios } from "@/modules/horarios";

export const GET = ruta(async (req, { params }) => {
  const apoderado = await requerirSesion(req, { roles: ["APODERADO"] });
  const estudianteId = esquemasHorarios.IdSchema.parse(params.id);
  const consulta = Object.fromEntries(new URL(req.url).searchParams);
  const { mes } = esquemasHorarios.ConsultaMesSchema.parse(consulta);
  return ok(await asistenciaDelHijo(apoderado, estudianteId, mes));
});
