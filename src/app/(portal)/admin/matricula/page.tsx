// AD-10 · Matrícula
"use client";

import { PaginaModulo } from "@/components/portal/PaginaModulo";
import { Boton } from "@/components/ui";
import { API } from "@/lib/rutasApi";

export default function MatriculaPage() {
  return (
    <PaginaModulo
      migas="Comunidad / Matrícula"
      titulo="Matrícula"
      descripcion="Matrículas activas, traslados de sección, retiros y anulaciones."
      endpoint={API.matricula.matriculas}
      acciones={
        <>
          <Boton variante="secundario" disabled title="M-05 · requiere API de traslado">
            Traslado de sección
          </Boton>
          <Boton variante="secundario" disabled title="M-18 · requiere API de retiro">
            Retirar estudiante
          </Boton>
          <Boton variante="secundario" disabled title="M-19 · requiere API de anulación">
            Anular matrícula
          </Boton>
        </>
      }
    />
  );
}
