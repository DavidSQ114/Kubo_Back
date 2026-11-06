// AP-01 · Inicio · Apoderado (US42, US43): saludo, aviso de pensiones vencidas con «Ver mis pagos» y próximo
// vencimiento del hijo elegido. Clases, libreta y asistencia llegarán con sus módulos.
"use client";

import Link from "next/link";
import { useHijo } from "@/components/apoderado/PortalApoderado";
import {
  AvisoAlDia,
  AvisoVencidas,
  CargandoPagos,
  ErrorPagos,
  usePagosDelHijo,
  type PagosDelHijo,
} from "@/components/apoderado/pagos";
import { Icono } from "@/components/ui";
import { fechaDia, fechaLarga, soles } from "@/lib/formato";

const MODULOS_PROXIMOS = ["Notas", "Asistencia", "Horario"];

function ProximoVencimiento({ datos }: { datos: PagosDelHijo }) {
  const proxima = datos.cuotas.find((c) => c.estado === "PENDIENTE");
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-borde bg-white p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-kubo-azul/10">
          <Icono nombre="icon-calendar" size={20} />
        </span>
        <span className="text-[14px] text-texto-2">Próximo vencimiento</span>
      </div>
      {proxima ? (
        <>
          <span className="text-[28px] font-bold leading-none text-texto">{fechaDia(proxima.fechaVencimiento)}</span>
          <span className="text-[13px] text-texto-3">
            {proxima.concepto} · {soles(proxima.monto)}
          </span>
        </>
      ) : (
        <span className="text-[16px] font-semibold text-texto">No tienes cuotas por vencer</span>
      )}
    </div>
  );
}

export default function InicioApoderadoPage() {
  const { sesion, hijo } = useHijo();
  const { carga, reintentar } = usePagosDelHijo(hijo.estudianteId, null);

  return (
    <>
      <header className="flex flex-col gap-1 border-b border-borde pb-6">
        <h1 className="text-[32px] font-bold leading-[1.2] text-texto">Hola, {sesion.usuario.nombres}</h1>
        <p className="text-[16px] text-texto-2">
          Así va {hijo.nombres.split(" ")[0]}
          {carga.fase === "listo" ? ` al ${fechaLarga(carga.datos.hoy)}` : ""}.
        </p>
      </header>

      {carga.fase === "cargando" && <CargandoPagos />}
      {carga.fase === "error" && <ErrorPagos mensaje={carga.mensaje} onReintentar={reintentar} />}
      {carga.fase === "listo" && (
        <>
          {carga.datos.resumen.cuotasVencidas > 0 ? (
            <AvisoVencidas
              datos={carga.datos}
              accion={
                <Link
                  href="/apoderado/pagos"
                  className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 text-[16px] font-bold text-kubo-azul ring-1 ring-inset ring-borde hover:bg-fondo"
                >
                  <Icono nombre="nav-wallet-azul" size={20} />
                  Ver mis pagos
                </Link>
              }
            />
          ) : (
            carga.datos.resumen.alDia && <AvisoAlDia />
          )}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ProximoVencimiento datos={carga.datos} />
            <div className="flex flex-col gap-2 rounded-lg border border-dashed border-borde bg-white p-5">
              <span className="text-[14px] text-texto-2">Próximamente en tu portal</span>
              <p className="text-[14px] leading-[1.5] text-texto-3">
                {MODULOS_PROXIMOS.join(", ")} de {hijo.nombres.split(" ")[0]} estarán disponibles en las próximas
                versiones.
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
