// DO-06 · Trabajos del curso
"use client";

import { PaginaModulo } from "@/components/portal/PaginaModulo";
import { Boton } from "@/components/ui";
import { API } from "@/lib/rutasApi";

export default function TrabajosDocentePage() {
  return (
    <PaginaModulo
      migas="Docente / Trabajos"
      titulo="Trabajos del curso"
      descripcion="Crea y administra trabajos vinculados a competencias (M-21)."
      endpoint={API.aulaVirtual.trabajos}
      acciones={
        <Boton variante="secundario" disabled title="Disponible cuando exista POST /aula-virtual/docente/trabajos">
          Crear trabajo
        </Boton>
      }
    />
  );
}
