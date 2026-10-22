// GET  /api/v1/academico/secciones?anioId= · Secciones del año con vacantes (US08, AD-03) · Solo Administrador
// POST /api/v1/academico/secciones          · Crear sección (US08) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { errores } from "@/platform/http/errores";
import { requerirSesion } from "@/modules/identidad";
import { crearSeccion, esquemasAcademico, listarSecciones } from "@/modules/academico";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const { anioId } = esquemasAcademico.ConsultaAnioSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  if (!anioId) throw errores.datosInvalidos({ anioId: "Indica el año académico" });
  return ok(await listarSecciones(anioId));
});

export const POST = ruta(async (req, { meta }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const datos = await leerCuerpo(req, esquemasAcademico.SeccionSchema);
  return ok(await crearSeccion(admin, datos, meta), 201);
});
