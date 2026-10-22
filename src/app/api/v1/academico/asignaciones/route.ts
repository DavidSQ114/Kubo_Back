// GET  /api/v1/academico/asignaciones?docenteId=&anioId= · Carga académica del docente (US14, AD-07) · Solo Administrador
// POST /api/v1/academico/asignaciones · Asignar un curso de la sección al docente (US14, RF11) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { asignarCurso, esquemasAcademico, listarAsignaciones } from "@/modules/academico";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const consulta = Object.fromEntries(new URL(req.url).searchParams);
  const { docenteId, anioId } = esquemasAcademico.ConsultaAsignacionesSchema.parse(consulta);
  return ok(await listarAsignaciones(docenteId, anioId));
});

export const POST = ruta(async (req, { meta }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const datos = await leerCuerpo(req, esquemasAcademico.AsignacionSchema);
  return ok(await asignarCurso(admin, datos, meta), 201);
});
