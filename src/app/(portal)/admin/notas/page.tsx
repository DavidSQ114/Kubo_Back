// AD-15 · Notas y rectificaciones
"use client";

import { PaginaModulo } from "@/components/portal/PaginaModulo";
import { Boton } from "@/components/ui";
import { API } from "@/lib/rutasApi";

export default function NotasAdminPage() {
  return (
    <PaginaModulo
      migas="Académico / Notas y rectificaciones"
      titulo="Notas y rectificaciones"
      descripcion="Supervisión de calificaciones, cierre de bimestre y solicitudes de rectificación."
      endpoint={API.evaluacion.notas}
      acciones={
        <>
          <Boton variante="secundario" disabled title="M-10 · cerrar bimestre">
            Cerrar bimestre
          </Boton>
          <Boton variante="secundario" disabled title="M-08 · rectificación">
            Rectificar nota
          </Boton>
        </>
      }
    />
  );
}
