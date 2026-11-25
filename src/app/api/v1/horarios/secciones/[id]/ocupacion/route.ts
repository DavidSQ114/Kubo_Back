// GET /api/v1/horarios/secciones/{id}/ocupacion?dia=&bloqueId= · Docentes y aulas que otras secciones ocupan en un
// día y bloque, para orientar la elección en el modal (US29, US30, M-06) · Solo Coordinador académico
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasHorarios, ocupacionDelBloque, ROLES_HORARIOS } from "@/modules/horarios";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ROLES_HORARIOS.GESTION });
  const seccionId = esquemasHorarios.IdSchema.parse(params.id);
  const consulta = Object.fromEntries(new URL(req.url).searchParams);
  const { dia, bloqueId } = esquemasHorarios.ConsultaOcupacionSchema.parse(consulta);
  return ok(await ocupacionDelBloque(seccionId, dia, bloqueId));
});
