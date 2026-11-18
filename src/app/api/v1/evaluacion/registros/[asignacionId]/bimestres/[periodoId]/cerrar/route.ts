// POST /api/v1/evaluacion/registros/{asignacionId}/bimestres/{periodoId}/cerrar · Cerrar registro del bimestre:
// exige todas las notas, consolida el logro del curso de cada alumno con la regla del bimestre y avisa a los
// administradores (US39, M-10); después el registro es de solo lectura (US40) · Solo Docente (solo sus cursos)
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { cerrarRegistro, esquemasEvaluacion } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const POST = ruta(async (req, { meta, params }) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  const { asignacionId, periodoId } = esquemasEvaluacion.RegistroParamsSchema.parse(params);
  return ok(await cerrarRegistro(docente, asignacionId, periodoId, meta));
});
