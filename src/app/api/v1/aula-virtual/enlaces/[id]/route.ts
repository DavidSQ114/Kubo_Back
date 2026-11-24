// PUT /api/v1/aula-virtual/enlaces/{id} · Editar un enlace de clase virtual (US62, M-17) · DELETE · Eliminarlo
// (auditado) · Solo Docente (solo los de su curso y sección del año en curso; otro, 404). Cuerpo del PUT: el mismo que
// al registrarlo.
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { editarEnlace, eliminarEnlace, esquemasAulaVirtual } from "@/modules/aula-virtual";
import { requerirSesion } from "@/modules/identidad";

export const PUT = ruta(async (req, { meta, params }) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  const enlaceId = esquemasAulaVirtual.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasAulaVirtual.EnlaceSchema);
  return ok(await editarEnlace(docente, enlaceId, datos, meta));
});

export const DELETE = ruta(async (req, { meta, params }) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  const enlaceId = esquemasAulaVirtual.IdSchema.parse(params.id);
  await eliminarEnlace(docente, enlaceId, meta);
  return ok({ id: enlaceId });
});
