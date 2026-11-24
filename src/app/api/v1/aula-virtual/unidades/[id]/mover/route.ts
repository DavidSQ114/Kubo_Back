// POST /api/v1/aula-virtual/unidades/{id}/mover · Subir o bajar una unidad didáctica un lugar en el orden (DO-05) ·
// Solo Docente (solo las de su curso y sección del año en curso; otra, 404). Cuerpo: { direccion: ARRIBA | ABAJO }.
// Responde todas las unidades del curso en su nuevo orden.
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { esquemasAulaVirtual, moverUnidad } from "@/modules/aula-virtual";
import { requerirSesion } from "@/modules/identidad";

export const POST = ruta(async (req, { params }) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  const unidadId = esquemasAulaVirtual.IdSchema.parse(params.id);
  const { direccion } = await leerCuerpo(req, esquemasAulaVirtual.MoverUnidadSchema);
  return ok(await moverUnidad(docente, unidadId, direccion));
});
