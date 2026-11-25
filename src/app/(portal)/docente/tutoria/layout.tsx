// Mi tutoría (bloque M3) · Marco de las páginas del tutor: carga su tutoría y muestra las pestañas
"use client";

import type { ReactNode } from "react";
import { GuardiaTutoria } from "@/components/docente/tutoria";

export default function TutoriaLayout({ children }: { children: ReactNode }) {
  return <GuardiaTutoria>{children}</GuardiaTutoria>;
}
