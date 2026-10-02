// DO-04 · Registro de notas
"use client";

import { PaginaModulo } from "@/components/portal/PaginaModulo";
import { API } from "@/lib/rutasApi";

export default function NotasDocentePage() {
  return (
    <PaginaModulo
      migas="Docente / Registro de notas"
      titulo="Registro de notas"
      descripcion="Calificaciones por competencia y evidencias pedagógicas."
      endpoint={API.evaluacionDocente.registroNotas}
    />
  );
}
