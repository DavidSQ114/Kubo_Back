import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
