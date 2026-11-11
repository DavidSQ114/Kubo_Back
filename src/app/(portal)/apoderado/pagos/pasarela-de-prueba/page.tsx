// AP-02P · Pasarela de prueba (US70): reemplaza al checkout de Mercado Pago cuando PASARELA=falsa (desarrollo y
// pruebas). Permite aprobar, rechazar o dejar en proceso el pago; el servidor rechaza la simulación en otro caso.
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PasarelaDePrueba } from "@/components/apoderado/pagoEnLinea";
import { CargandoPagos } from "@/components/apoderado/pagos";

function Pasarela() {
  const intentoId = useSearchParams().get("intento");
  return <PasarelaDePrueba intentoId={intentoId} />;
}

export default function PasarelaDePruebaPage() {
  return (
    <>
      <header className="flex flex-col gap-1 border-b border-borde pb-6">
        <h1 className="text-[32px] font-bold leading-[1.2] text-texto">Checkout de prueba</h1>
        <p className="text-[16px] text-texto-2">Simula la respuesta de la pasarela de pagos.</p>
      </header>
      <Suspense fallback={<CargandoPagos />}>
        <Pasarela />
      </Suspense>
    </>
  );
}
