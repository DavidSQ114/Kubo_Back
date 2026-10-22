// PATCH  /api/v1/academico/secciones/{id} · Editar sección: grado, nombre, aforo, aula, tutor (US08) · Solo Administrador
// DELETE /api/v1/academico/secciones/{id} · Eliminar sección sin matrículas (US08) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { editarSeccion, eliminarSeccion, esquemasAcademico } from "@/modules/academico";

export const PATCH = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const seccionId = esquemasAcademico.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasAcademico.EditarSeccionSchema);
  return ok(await editarSeccion(admin, seccionId, datos, meta));
});

export const DELETE = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  return ok(await eliminarSeccion(admin, esquemasAcademico.IdSchema.parse(params.id), meta));
});
