// GET /api/v1/comunidad/usuarios?q=&rol=&estado=&pagina=&tamano= · Buscar usuarios (RF46, AD-06) · Solo Administrador
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasComunidad, listarUsuarios } from "@/modules/comunidad";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const consulta = Object.fromEntries(new URL(req.url).searchParams);
  const filtro = esquemasComunidad.FiltroUsuariosSchema.parse(consulta);
  return ok(await listarUsuarios(filtro));
});
