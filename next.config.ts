import type { NextConfig } from "next";

/**
 * Bloque M1: las pantallas académicas, de matrícula, pagos, horarios, notas y asistencia de alumnos pasaron del portal
 * del Administrador (/admin/*) al del Coordinador académico (/coordinador/*). Las rutas viejas redirigen (con su
 * query, por ejemplo ?estudiante=) para que ningún enlace guardado quede roto. Temporales: no se cachean.
 */
const PANTALLAS_MOVIDAS = [
  "anio",
  "grados",
  "cursos",
  "reglas",
  "matricula",
  "pagos",
  "morosidad",
  "horarios",
  "asistencia",
  "notas",
] as const;

const nextConfig: NextConfig = {
  async redirects() {
    return PANTALLAS_MOVIDAS.flatMap((pantalla) => [
      { source: `/admin/${pantalla}`, destination: `/coordinador/${pantalla}`, permanent: false },
      { source: `/admin/${pantalla}/:resto*`, destination: `/coordinador/${pantalla}/:resto*`, permanent: false },
    ]);
  },
};

export default nextConfig;
