// POST /api/v1/horarios/secciones/{id}/borrador · Abrir un borrador para editar el horario: con las clases de la
// versión publicada o vacío si la sección aún no tiene horario (US31, AD-13) · Solo Coordinador académico
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { crearBorrador, esquemasHorarios, ROLES_HORARIOS } from "@/modules/horarios";

export const POST = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ROLES_HORARIOS.GESTION });
  return ok(await crearBorrador(esquemasHorarios.IdSchema.parse(params.id)), 201);
});
