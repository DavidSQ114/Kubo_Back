// GET /api/v1/matricula/estudiantes/{id}?anioId= · Apoderados, matrícula vigente y cronograma previsto del estudiante (US18, US21, AD-10) · Solo Administrador
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasMatricula, situacionEstudiante } from "@/modules/matricula";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const id = esquemasMatricula.IdSchema.parse(params.id);
  const { anioId } = esquemasMatricula.ConsultaAnioSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await situacionEstudiante(id, anioId));
});
