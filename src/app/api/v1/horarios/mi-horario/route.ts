// GET /api/v1/horarios/mi-horario?anioId= · «Mi horario» del docente en sesión: sus clases en los horarios
// publicados del año, con curso, sección y aula (US34, RF24, DO-02) · Solo Docente
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
