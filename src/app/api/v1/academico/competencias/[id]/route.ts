// PATCH  /api/v1/academico/competencias/{id} · Editar nombre o descripción, o activar/desactivar, con auditoría del
//        valor anterior y el nuevo (US56, criterios 2 y 3) · Solo Administrador
// DELETE /api/v1/academico/competencias/{id} · Eliminar una competencia sin planes de estudios ni calificaciones
//        (US56, criterio 2) · Solo Administrador · 409 COMPETENCIA_CON_CALIFICACIONES o COMPETENCIA_EN_PLAN
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { editarCompetencia, eliminarCompetencia, esquemasAcademico } from "@/modules/academico";

export const PATCH = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const competenciaId = esquemasAcademico.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasAcademico.EditarCompetenciaSchema);
  return ok(await editarCompetencia(admin, competenciaId, datos, meta));
});

export const DELETE = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  return ok(await eliminarCompetencia(admin, esquemasAcademico.IdSchema.parse(params.id), meta));
});
