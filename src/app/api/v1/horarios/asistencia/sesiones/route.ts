// GET  /api/v1/horarios/asistencia/sesiones?fecha= · Sesiones de clase: el docente ve las suyas (sin fecha, las de
//      los últimos días) y el coordinador académico, todas las de la fecha (US36) · Docente y Coordinador académico
// POST /api/v1/horarios/asistencia/sesiones · Abrir la sesión de una clase de hoy: se crea si no existe y devuelve la
//      lista de alumnos (US35, DO-03) · Solo Docente · 403 CLASE_AJENA si la clase no es suya
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { abrirSesion, esquemasHorarios, listarSesiones, ROLES_HORARIOS } from "@/modules/horarios";

export const GET = ruta(async (req) => {
  const sesion = await requerirSesion(req, { roles: ROLES_HORARIOS.ASISTENCIA_ALUMNOS });
  const consulta = Object.fromEntries(new URL(req.url).searchParams);
  return ok(await listarSesiones(sesion, esquemasHorarios.ConsultaSesionesSchema.parse(consulta)));
});

export const POST = ruta(async (req) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  const datos = await leerCuerpo(req, esquemasHorarios.AbrirSesionSchema);
  return ok(await abrirSesion(docente, datos), 201);
});
