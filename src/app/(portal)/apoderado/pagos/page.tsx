// AP-02 · Pagos · Apoderado (US43, US44, US70): resumen pagado, vencido y pendiente, cronograma con estados, vencidas
// resaltadas, «Estás al día con tus pagos», descarga del comprobante de cada cuota pagada y «Pagar» en línea.
"use client";

import { useState } from "react";
import { useHijo } from "@/components/apoderado/PortalApoderado";
import {
  AvisoAlDia,
  CargandoPagos,
  ComoPagar,
  ErrorPagos,
  ResumenPagos,
  TablaCronograma,
  usePagosDelHijo,
} from "@/components/apoderado/pagos";
import { BotonPagar } from "@/components/apoderado/pagoEnLinea";

export default function PagosApoderadoPage() {
  const { hijo } = useHijo();
  const [anioId, setAnioId] = useState<string | null>(null);
  const { carga, reintentar } = usePagosDelHijo(hijo.estudianteId, anioId);
  const datos = carga.fase === "listo" ? carga.datos : null;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-borde pb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-[32px] font-bold leading-[1.2] text-texto">Pagos</h1>
          <p className="text-[16px] text-texto-2">
            Cronograma de pensiones {datos?.matricula.anio ?? hijo.anio} de {hijo.nombres.split(" ")[0]}. Descarga tus
            comprobantes de los pagos realizados.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {datos && <BotonPagar key={datos.matricula.anioId} datos={datos} />}
          {datos && datos.anios.length > 1 && (
            <label className="flex flex-col gap-1 text-[13px] text-texto-2">
              Año académico
              <select
                value={datos.matricula.anioId}
                onChange={(e) => setAnioId(e.target.value)}
                className="rounded-lg border border-borde bg-white px-4 py-2.5 text-[15px] text-texto"
              >
                {datos.anios.map((a) => (
                  <option key={a.anioId} value={a.anioId}>
                    {a.anio}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </header>

      {carga.fase === "cargando" && <CargandoPagos />}
      {carga.fase === "error" && <ErrorPagos mensaje={carga.mensaje} onReintentar={reintentar} />}
      {datos && (
        <>
          <ResumenPagos datos={datos} />
          {datos.resumen.alDia && datos.cuotas.length > 0 && <AvisoAlDia />}
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_320px]">
            <TablaCronograma datos={datos} />
            <ComoPagar codigo={datos.estudiante.codigoPago} enLinea={datos.pagoEnLinea} />
          </div>
        </>
      )}
    </>
  );
}
