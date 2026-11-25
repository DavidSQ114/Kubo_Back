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
  // Bloque M5: Kubo no usa next/image. Se apaga el optimizador de imágenes (/_next/image), la vía de la vulnerabilidad
  // crítica de next 16.0–16.4.4 con SVG (GHSA-2464-fhr4-w9xw), corregida recién en 16.4.6, fuera de la versión menor.
  images: { unoptimized: true },
  // Bloque M5: cabeceras de seguridad en todas las respuestas (páginas, API y descargas).
  async headers() {
    return [
      {
        source: "/:ruta*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  async redirects() {
    return PANTALLAS_MOVIDAS.flatMap((pantalla) => [
      { source: `/admin/${pantalla}`, destination: `/coordinador/${pantalla}`, permanent: false },
      { source: `/admin/${pantalla}/:resto*`, destination: `/coordinador/${pantalla}/:resto*`, permanent: false },
    ]);
  },
};

export default nextConfig;
