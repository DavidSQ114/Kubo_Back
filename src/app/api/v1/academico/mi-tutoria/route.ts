// GET /api/v1/academico/mi-tutoria · Secciones del año en curso de las que el docente es tutor o cotutor (bloque M3)
// · Solo Docente. Vacía si no tiene tutoría: el portal no muestra «Mi tutoría».
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { misTutorias, ROLES_ACADEMICO } from "@/modules/academico";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req) => {
  const docente = await requerirSesion(req, { roles: ROLES_ACADEMICO.TUTORIA });
  const tutorias = await misTutorias(docente);
  return ok({
    tutorias: tutorias.map((t) => ({ rol: t.rol, seccion: t.seccion, anio: t.anio })),
  });
});
