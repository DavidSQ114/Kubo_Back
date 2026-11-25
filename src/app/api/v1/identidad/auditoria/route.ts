// GET /api/v1/identidad/auditoria?desde=&hasta=&accion=&pagina= · Bitácora de operaciones críticas (RF03, AD-16
// «Operaciones auditadas», bloque M1), de la más reciente a la más antigua · Solo Administrador
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { esquemasIdentidad, listarAuditoria, requerirSesion, ROLES_IDENTIDAD } from "@/modules/identidad";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ROLES_IDENTIDAD.AUDITORIA });
  const filtro = esquemasIdentidad.FiltroAuditoriaSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await listarAuditoria(filtro));
});
