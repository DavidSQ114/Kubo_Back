// AD-14 · Asistencia docente
"use client";

import { PaginaModulo } from "@/components/portal/PaginaModulo";
import { API } from "@/lib/rutasApi";

export default function AsistenciaDocentePage() {
  return (
    <PaginaModulo
      migas="Académico / Asistencia docente"
      titulo="Asistencia docente"
      descripcion="Registro de asistencia del personal docente a sus sesiones."
      endpoint={API.horarios.asistenciaDocente}
    />
  );
}
