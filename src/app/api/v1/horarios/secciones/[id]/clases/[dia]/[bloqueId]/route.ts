// PUT    /api/v1/horarios/secciones/{id}/clases/{dia}/{bloqueId} · Asignar o cambiar la clase de un bloque, sin
//        cruces de docente ni de aula (US28, US29, US30, RF22, RF23, M-06) · Solo Coordinador académico
// DELETE /api/v1/horarios/secciones/{id}/clases/{dia}/{bloqueId} · Vaciar un bloque del borrador (US28)
//        · Solo Coordinador académico
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { asignarClase, esquemasHorarios, quitarClase, ROLES_HORARIOS } from "@/modules/horarios";

export const PUT = ruta(async (req, { meta, params }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_HORARIOS.GESTION });
  const seccionId = esquemasHorarios.IdSchema.parse(params.id);
  const celda = esquemasHorarios.CeldaSchema.parse({ dia: params.dia, bloqueId: params.bloqueId });
  const datos = await leerCuerpo(req, esquemasHorarios.ClaseSchema);
  return ok(await asignarClase(coordinador, seccionId, celda, datos, meta));
});

export const DELETE = ruta(async (req, { meta, params }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_HORARIOS.GESTION });
  const seccionId = esquemasHorarios.IdSchema.parse(params.id);
  const celda = esquemasHorarios.CeldaSchema.parse({ dia: params.dia, bloqueId: params.bloqueId });
  return ok(await quitarClase(coordinador, seccionId, celda, meta));
});
