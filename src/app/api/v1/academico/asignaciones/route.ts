// GET  /api/v1/academico/asignaciones?docenteId=&anioId= · Carga académica del docente (US14, AD-07) · Solo Coordinador académico
// POST /api/v1/academico/asignaciones · Asignar un curso de la sección al docente (US14, RF11) · Solo Coordinador académico
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { asignarCurso, esquemasAcademico, listarAsignaciones, ROLES_ACADEMICO } from "@/modules/academico";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ROLES_ACADEMICO.GESTION });
  const consulta = Object.fromEntries(new URL(req.url).searchParams);
  const { docenteId, anioId } = esquemasAcademico.ConsultaAsignacionesSchema.parse(consulta);
  return ok(await listarAsignaciones(docenteId, anioId));
});

export const POST = ruta(async (req, { meta }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_ACADEMICO.GESTION });
  const datos = await leerCuerpo(req, esquemasAcademico.AsignacionSchema);
  return ok(await asignarCurso(coordinador, datos, meta), 201);
});
