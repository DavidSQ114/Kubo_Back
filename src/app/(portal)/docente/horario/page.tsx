// DO-02 · Mi horario
"use client";

import { PaginaModulo } from "@/components/portal/PaginaModulo";
import { API } from "@/lib/rutasApi";

export default function HorarioDocentePage() {
  return (
    <PaginaModulo
      migas="Docente / Mi horario"
      titulo="Mi horario"
      descripcion="Clases asignadas en el bimestre en curso."
      endpoint={API.horariosDocente.miHorario}
    />
  );
}
