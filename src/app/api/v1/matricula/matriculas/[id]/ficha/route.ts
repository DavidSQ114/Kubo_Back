// GET /api/v1/matricula/matriculas/{id}/ficha · Ficha de matrícula en PDF (US20, AD-10) · Solo Coordinador académico
import "@/server/wiring";
import { pdf, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasMatricula, generarFichaMatricula, ROLES_MATRICULA } from "@/modules/matricula";

export const GET = ruta(async (req, { meta, params }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_MATRICULA.GESTION });
  const id = esquemasMatricula.IdSchema.parse(params.id);
  const ficha = await generarFichaMatricula(coordinador, id, meta);
  return pdf(ficha.bytes, ficha.nombreArchivo);
});
