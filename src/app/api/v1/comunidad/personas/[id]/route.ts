// GET    /api/v1/comunidad/personas/{id} · Detalle de la persona para AD-06 (US69)
// PATCH  /api/v1/comunidad/personas/{id} · Editar sus datos con auditoría (US69, RF03)
// DELETE /api/v1/comunidad/personas/{id}?perfil= · Eliminarla o, si tiene registros, desactivar su perfil (US69)
// Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { detallePersona, editarPersona, eliminarPersona, esquemasComunidad } from "@/modules/comunidad";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const personaId = esquemasComunidad.IdPersonaSchema.parse(params.id);
  return ok(await detallePersona(personaId));
});

export const PATCH = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const personaId = esquemasComunidad.IdPersonaSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasComunidad.EditarPersonaSchema);
  return ok(await editarPersona(admin, personaId, datos, meta));
});

export const DELETE = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const personaId = esquemasComunidad.IdPersonaSchema.parse(params.id);
  const opciones = esquemasComunidad.BajaPersonaSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await eliminarPersona(admin, personaId, opciones, meta));
});
