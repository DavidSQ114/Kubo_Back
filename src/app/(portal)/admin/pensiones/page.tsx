// AD-11 · Pensiones y pagos
"use client";

import { PaginaModulo } from "@/components/portal/PaginaModulo";
import { Boton } from "@/components/ui";
import { API } from "@/lib/rutasApi";

export default function PensionesPage() {
  return (
    <PaginaModulo
      migas="Tesorería / Pensiones y pagos"
      titulo="Pensiones y pagos"
      descripcion="Conceptos de cobro, operaciones de pago y comprobantes."
      endpoint={API.tesoreria.conceptos}
      acciones={
        <>
          <Boton disabled title="M-01 · POST /matricula/pagos">
            Registrar pago
          </Boton>
          <Boton variante="secundario" disabled title="M-02 · anular pago">
            Anular pago
          </Boton>
          <Boton variante="secundario" disabled title="M-15 · pago anual">
            Pago anual
          </Boton>
        </>
      }
    />
  );
}
