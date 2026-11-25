// GET  /api/v1/academico/aulas?anioId= · Aulas con su sección asignada y ocupación (US09, AD-03) · Coordinador académico y Administrador (lectura)
// POST /api/v1/academico/aulas          · Registrar aula (US09) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { crearAula, esquemasAcademico, listarAulas, ROLES_ACADEMICO } from "@/modules/academico";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ROLES_ACADEMICO.CONSULTA });
  const { anioId } = esquemasAcademico.ConsultaAnioSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await listarAulas(anioId));
});

export const POST = ruta(async (req, { meta }) => {
  const admin = await requerirSesion(req, { roles: ROLES_ACADEMICO.ESPACIOS });
  const datos = await leerCuerpo(req, esquemasAcademico.AulaSchema);
  return ok(await crearAula(admin, datos, meta), 201);
});
