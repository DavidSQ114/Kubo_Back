// GET  /api/v1/academico/anios · Listar años académicos con sus bimestres (US06, AD-02) · Solo Administrador
// POST /api/v1/academico/anios · Crear año académico en estado PLANIFICADO (US06) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { crearAnio, esquemasAcademico, listarAnios } from "@/modules/academico";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  return ok(await listarAnios());
});

export const POST = ruta(async (req, { meta }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const datos = await leerCuerpo(req, esquemasAcademico.CrearAnioSchema);
  return ok(await crearAnio(admin, datos, meta), 201);
});
