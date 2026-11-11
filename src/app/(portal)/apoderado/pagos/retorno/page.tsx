// AP-02R · Resultado del pago en línea (US70): a esta pantalla vuelve el apoderado desde el checkout. Muestra el estado
// registrado en Kubo (aprobado, rechazado, en proceso, expirado o en revisión); la URL de retorno nunca confirma un pago.
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ResultadoPagoEnLinea } from "@/components/apoderado/pagoEnLinea";
import { CargandoPagos } from "@/components/apoderado/pagos";

function Retorno() {
  const intentoId = useSearchParams().get("intento");
  return <ResultadoPagoEnLinea intentoId={intentoId} />;
}

export default function RetornoPagoPage() {
  return (
    <>
      <header className="flex flex-col gap-1 border-b border-borde pb-6">
        <h1 className="text-[32px] font-bold leading-[1.2] text-texto">Pago en línea</h1>
        <p className="text-[16px] text-texto-2">Estado de tu pago en Kubo.</p>
      </header>
      {/* useSearchParams (?intento=) necesita un límite de Suspense */}
      <Suspense fallback={<CargandoPagos />}>
        <Retorno />
      </Suspense>
    </>
  );
}
