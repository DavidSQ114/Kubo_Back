// GET /api/v1/matricula/estudiantes/{id}/estado-cuenta?anioId= · Estado de cuenta (AD-11, US22) · Solo Administrador
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasMatricula, estadoDeCuenta } from "@/modules/matricula";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const id = esquemasMatricula.IdSchema.parse(params.id);
  const { anioId } = esquemasMatricula.ConsultaEstadoCuentaSchema.parse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  return ok(await estadoDeCuenta(id, anioId));
});
