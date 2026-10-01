import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// IBM Plex Sans (latin) servida desde el repositorio: el build no depende de descargarla de Google Fonts.
// Es la fuente variable (un solo archivo para los pesos 100 a 700), la misma que entrega Google.
// El archivo y su licencia OFL están en src/app/fuentes/.
const plex = localFont({
  src: "./fuentes/ibm-plex-sans-latin-wght-normal.woff2",
  weight: "100 700",
  style: "normal",
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
