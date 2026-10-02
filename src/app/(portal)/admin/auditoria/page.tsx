// AD-16 · Auditoría
"use client";

import { PaginaModulo } from "@/components/portal/PaginaModulo";
import { API } from "@/lib/rutasApi";

export default function AuditoriaPage() {
  return (
    <PaginaModulo
      migas="Seguridad / Auditoría"
      titulo="Auditoría"
      descripcion="Bitácora inmutable de acciones críticas (RF03)."
      endpoint={API.auditoria.registros}
    />
  );
}
