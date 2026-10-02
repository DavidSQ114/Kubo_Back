// DO-05 · Mis cursos
"use client";

import { PaginaModulo } from "@/components/portal/PaginaModulo";
import { API } from "@/lib/rutasApi";

export default function CursosDocentePage() {
  return (
    <PaginaModulo
      migas="Docente / Mis cursos"
      titulo="Mis cursos"
      descripcion="Unidades didácticas, materiales y enlaces de tus asignaciones."
      endpoint={API.aulaVirtual.misCursos}
    />
  );
}
