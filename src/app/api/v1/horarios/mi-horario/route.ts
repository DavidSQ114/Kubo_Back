// GET /api/v1/horarios/mi-horario?anioId= · Clases del docente en sesión en los horarios publicados del año
// (US31, RF24; base de DO-02 «Mi horario») · Solo Docente
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasHorarios, miHorarioDocente } from "@/modules/horarios";

export const GET = ruta(async (req) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  const consulta = Object.fromEntries(new URL(req.url).searchParams);
  const { anioId } = esquemasHorarios.ConsultaAnioSchema.parse(consulta);
  return ok(await miHorarioDocente(docente, anioId));
});
