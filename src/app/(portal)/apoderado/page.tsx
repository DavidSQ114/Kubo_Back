// AP-01 · Inicio · Apoderado (US42, US43): saludo, aviso de pensiones vencidas con «Pagar» en línea (US70) o «Ver mis
// pagos», próximo vencimiento del hijo elegido y acceso a su horario (US48), su asistencia (US45) y sus notas (US46).
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
                  {carga.datos.pagoEnLinea ? "Pagar" : "Ver mis pagos"}
                </Link>
              }
            />
          ) : (
            carga.datos.resumen.alDia && <AvisoAlDia />
          )}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ProximoVencimiento datos={carga.datos} />
            <Link
              href="/apoderado/horario"
              className="flex flex-col gap-3 rounded-lg border border-borde bg-white p-5 hover:border-kubo-azul"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-kubo-azul/10">
                  <Icono nombre="nav-grid-azul" size={20} />
                </span>
                <span className="text-[14px] text-texto-2">Horario de clases</span>
              </div>
              <span className="text-[16px] font-semibold text-texto">
                Ver el horario de {hijo.nombres.split(" ")[0]}
              </span>
              <span className="text-[13px] text-texto-3">Curso, aula y docente de cada bloque de la semana.</span>
            </Link>
            <Link
              href="/apoderado/asistencia"
              className="flex flex-col gap-3 rounded-lg border border-borde bg-white p-5 hover:border-kubo-azul"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-kubo-azul/10">
                  <Icono nombre="nav-usercheck-azul" size={20} />
                </span>
                <span className="text-[14px] text-texto-2">Asistencia</span>
              </div>
              <span className="text-[16px] font-semibold text-texto">
                Ver la asistencia de {hijo.nombres.split(" ")[0]}
              </span>
              <span className="text-[13px] text-texto-3">Resumen del mes por día, inasistencias y tardanzas.</span>
            </Link>
            <Link
              href="/apoderado/notas"
              className="flex flex-col gap-3 rounded-lg border border-borde bg-white p-5 hover:border-kubo-azul"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-kubo-azul/10">
                  <Icono nombre="nav-award-azul" size={20} />
                </span>
                <span className="text-[14px] text-texto-2">Notas</span>
              </div>
              <span className="text-[16px] font-semibold text-texto">
                Ver la libreta de {hijo.nombres.split(" ")[0]}
              </span>
              <span className="text-[13px] text-texto-3">
                Logros por curso y competencia de cada bimestre publicado.
              </span>
            </Link>
          </div>
        </>
      )}
    </>
  );
}
