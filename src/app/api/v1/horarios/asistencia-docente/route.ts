// GET /api/v1/horarios/asistencia-docente?fecha= · Asistencia del personal docente de un día (por defecto, hoy):
//     docentes activos con su registro, primera clase y contadores (US32, AD-14) · Solo Administrador
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { asistenciaDocenteDelDia, esquemasHorarios } from "@/modules/horarios";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const consulta = Object.fromEntries(new URL(req.url).searchParams);
  return ok(await asistenciaDocenteDelDia(esquemasHorarios.ConsultaAsistenciaDocenteSchema.parse(consulta)));
});
