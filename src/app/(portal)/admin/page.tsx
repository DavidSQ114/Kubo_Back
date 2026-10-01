// AD-01 · Inicio del Administrador. Sus indicadores dependen de los módulos académico, matrícula y pagos,
// que aún no existen; por ahora muestra la bienvenida y los accesos disponibles.
"use client";

import Link from "next/link";
import { useSesion } from "@/components/admin/PortalAdmin";
import { Alerta, Icono, Tarjeta } from "@/components/ui";

export default function InicioAdminPage() {
  const sesion = useSesion();
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <p className="text-[14px] leading-[1.4] text-texto-3">Inicio</p>
        <h1 className="text-[32px] font-bold leading-[1.2] text-texto">Hola, {sesion.usuario.nombres}</h1>
        <p className="text-[16px] leading-[1.5] text-texto-2">Este es tu panel de administración de Kubo.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Link href="/admin/usuarios" className="group">
          <Tarjeta className="flex h-full flex-col gap-3 p-5 transition group-hover:border-kubo-azul">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[rgba(27,77,137,0.12)]">
              <Icono nombre="kpi-users" size={20} />
            </div>
            <p className="text-[16px] font-semibold text-texto">Usuarios</p>
            <p className="text-[14px] leading-[1.4] text-texto-2">Busca usuarios, registra administradores y suspende o reactiva accesos.</p>
          </Tarjeta>
        </Link>
      </div>
      <Alerta tipo="info" titulo="Más módulos en camino">
        Año y bimestres, matrícula, pensiones, horarios, notas y auditoría se habilitarán en el menú a medida que se construyan.
      </Alerta>
    </>
  );
}
