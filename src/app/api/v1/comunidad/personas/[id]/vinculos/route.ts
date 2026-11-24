// GET /api/v1/comunidad/personas/{id}/vinculos · Vínculos de la persona: apoderados de un estudiante e hijos de un
// apoderado, con la sección y el estado de la matrícula de cada hijo (D-12, AD-06) · Solo Administrador
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasComunidad, vinculosDePersona } from "@/modules/comunidad";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const personaId = esquemasComunidad.IdPersonaSchema.parse(params.id);
  return ok(await vinculosDePersona(personaId));
});
