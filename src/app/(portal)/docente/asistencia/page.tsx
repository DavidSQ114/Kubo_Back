// DO-03 · Asistencia
"use client";

import { PaginaModulo } from "@/components/portal/PaginaModulo";
import { API } from "@/lib/rutasApi";

export default function AsistenciaDocentePage() {
  return (
    <PaginaModulo
      migas="Docente / Asistencia"
      titulo="Asistencia"
      descripcion="Sesiones de clase y registro de asistencia de estudiantes."
      endpoint={API.horariosDocente.asistencia}
    />
  );
}
