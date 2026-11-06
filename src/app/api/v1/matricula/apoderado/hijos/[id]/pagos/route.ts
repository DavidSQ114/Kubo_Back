// GET /api/v1/matricula/apoderado/hijos/{id}/pagos?anioId= · Deudas y pagos del hijo (US43, AP-02) · Solo Apoderado
// 403 ESTUDIANTE_NO_VINCULADO si el estudiante no es hijo de la persona en sesión.
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasMatricula, pagosDelHijo } from "@/modules/matricula";

export const GET = ruta(async (req, { params }) => {
  const apoderado = await requerirSesion(req, { roles: ["APODERADO"] });
  const estudianteId = esquemasMatricula.IdSchema.parse(params.id);
  const { anioId } = esquemasMatricula.ConsultaEstadoCuentaSchema.parse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  return ok(await pagosDelHijo(apoderado, estudianteId, anioId));
});
