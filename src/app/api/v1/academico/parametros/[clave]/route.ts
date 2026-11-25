// PUT /api/v1/academico/parametros/{clave} · Actualizar un parámetro general con validación por tipo y auditoría
// ACTUALIZAR_PARAMETRO (bloque M1) · Solo Administrador · 400 PARAMETRO_INVALIDO · 404 PARAMETRO_NO_EDITABLE
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { actualizarParametroSistema, esquemasAcademico, ROLES_ACADEMICO } from "@/modules/academico";

export const PUT = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ROLES_ACADEMICO.PARAMETROS_SISTEMA });
  const clave = esquemasAcademico.ClaveParametroSchema.parse(params.clave);
  const datos = await leerCuerpo(req, esquemasAcademico.ActualizarParametroSchema);
  return ok(await actualizarParametroSistema(admin, clave, datos, meta));
});
