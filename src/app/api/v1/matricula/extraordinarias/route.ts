// GET /api/v1/matricula/extraordinarias?anioId= · Lotes de cuotas extraordinarias del año (bloque M4) · Solo Coordinador académico
// POST /api/v1/matricula/extraordinarias · Crear un lote de cuotas extraordinarias (bloque M4) · Solo Coordinador académico
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { crearLote, esquemasMatricula, listarLotes, ROLES_MATRICULA } from "@/modules/matricula";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ROLES_MATRICULA.GESTION });
  const { anioId } = esquemasMatricula.ConsultaAnioSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await listarLotes(anioId));
});

export const POST = ruta(async (req, { meta }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_MATRICULA.GESTION });
  const datos = await leerCuerpo(req, esquemasMatricula.LoteExtraordinarioSchema);
  return ok(await crearLote(coordinador, datos, meta), 201);
});
