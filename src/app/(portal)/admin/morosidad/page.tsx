// AD-12 · Morosidad
"use client";

import { PaginaModulo } from "@/components/portal/PaginaModulo";
import { Boton } from "@/components/ui";
import { API } from "@/lib/rutasApi";

export default function MorosidadPage() {
  return (
    <PaginaModulo
      migas="Tesorería / Morosidad"
      titulo="Morosidad"
      descripcion="Estudiantes con conceptos vencidos y envío de recordatorios."
      endpoint={API.tesoreria.morosidad}
      acciones={
        <Boton variante="secundario" disabled title="M-24 · recordatorios de pago">
          Enviar recordatorios
        </Boton>
      }
    />
  );
}
