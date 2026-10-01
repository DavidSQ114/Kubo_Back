import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// IBM Plex Sans (latin) servida desde el repositorio: el build no depende de descargarla de Google Fonts.
// Los archivos y su licencia OFL están en src/app/fuentes/.
const plex = localFont({
  src: [
    { path: "./fuentes/ibm-plex-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fuentes/ibm-plex-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fuentes/ibm-plex-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fuentes/ibm-plex-sans-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kubo · Plataforma Educativa Integral",
  description: "Sistema de gestión escolar: matrícula, horarios, asistencia, evaluación y aula virtual.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={plex.variable}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
