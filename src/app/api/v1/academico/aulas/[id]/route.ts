// PATCH /api/v1/academico/aulas/{id} · Editar nombre, ubicación o aforo del aula (US09) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { editarAula, esquemasAcademico } from "@/modules/academico";

export const PATCH = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const aulaId = esquemasAcademico.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasAcademico.EditarAulaSchema);
  return ok(await editarAula(admin, aulaId, datos, meta));
});
