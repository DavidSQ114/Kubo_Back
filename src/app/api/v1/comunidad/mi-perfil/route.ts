// GET   /api/v1/comunidad/mi-perfil · Datos de la persona en sesión: nombres, DNI enmascarado, correo, teléfono,
//       dirección, roles y último ingreso (bloque M1) · Todos los perfiles
// PATCH /api/v1/comunidad/mi-perfil · Cambiar el propio teléfono o dirección; auditoría ACTUALIZAR_PERFIL
//       (bloque M1) · Todos los perfiles · 400 si se intenta cambiar el correo o el DNI
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { actualizarMiPerfil, esquemasComunidad, miPerfil, ROLES_COMUNIDAD } from "@/modules/comunidad";

export const GET = ruta(async (req) => {
  const auth = await requerirSesion(req, { roles: ROLES_COMUNIDAD.MI_PERFIL });
  return ok(await miPerfil(auth));
});

export const PATCH = ruta(async (req, { meta }) => {
  const auth = await requerirSesion(req, { roles: ROLES_COMUNIDAD.MI_PERFIL });
  const datos = await leerCuerpo(req, esquemasComunidad.ActualizarMiPerfilSchema);
  return ok(await actualizarMiPerfil(auth, datos, meta));
});
