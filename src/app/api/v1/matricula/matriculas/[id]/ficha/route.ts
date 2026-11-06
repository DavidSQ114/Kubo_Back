// GET /api/v1/matricula/matriculas/{id}/ficha · Ficha de matrícula en PDF (US20, AD-10) · Solo Administrador
import "@/server/wiring";
import { pdf, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasMatricula, generarFichaMatricula } from "@/modules/matricula";

export const GET = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const id = esquemasMatricula.IdSchema.parse(params.id);
  const ficha = await generarFichaMatricula(admin, id, meta);
  return pdf(ficha.bytes, ficha.nombreArchivo);
});
