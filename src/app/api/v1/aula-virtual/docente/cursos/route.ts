// GET /api/v1/aula-virtual/docente/cursos · Cursos y secciones del aula virtual del docente en sesión (DO-05): sus
// asignaciones activas del año EN_CURSO · Solo Docente.
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { cursosDelAula } from "@/modules/aula-virtual";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  return ok(await cursosDelAula(docente));
});
