// DO-07 · Revisar entregas
"use client";

import { PaginaModulo } from "@/components/portal/PaginaModulo";
import { API } from "@/lib/rutasApi";

export default function EntregasDocentePage() {
  return (
    <PaginaModulo
      migas="Docente / Entregas"
      titulo="Revisar entregas"
      descripcion="Entregas de estudiantes y retroalimentación (M-09)."
      endpoint={API.aulaVirtual.entregas}
    />
  );
}
