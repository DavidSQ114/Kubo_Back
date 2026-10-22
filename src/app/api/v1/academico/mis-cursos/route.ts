// GET /api/v1/academico/mis-cursos · Cursos y secciones del docente en sesión (US14, criterio 1) · Solo Docente
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { misCursos } from "@/modules/academico";

export const GET = ruta(async (req) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  return ok(await misCursos(docente));
});
