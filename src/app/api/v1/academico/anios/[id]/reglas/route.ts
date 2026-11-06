// GET  /api/v1/academico/anios/{id}/reglas · Regla vigente, historial y bimestres del año (US12, AD-05) · Solo Administrador
// POST /api/v1/academico/anios/{id}/reglas · Guardar una nueva versión de la regla (US12, RF10) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasAcademico, guardarRegla, reglasDelAnio } from "@/modules/academico";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  return ok(await reglasDelAnio(esquemasAcademico.IdSchema.parse(params.id)));
});

export const POST = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const anioId = esquemasAcademico.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasAcademico.ReglaSchema);
  return ok(await guardarRegla(admin, anioId, datos, meta), 201);
});
