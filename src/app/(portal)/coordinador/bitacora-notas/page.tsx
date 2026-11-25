// AD-16 · «Cambios de notas» (bitácora de notas, US03) en el portal del Coordinador académico (bloque M1): de solo
// lectura, con filtros por fecha y por docente. Antes era una pestaña de «Auditoría» del Administrador.
"use client";

import { BitacoraNotas } from "@/components/admin/bitacoraNotas";
import { Alerta } from "@/components/ui";

export default function BitacoraNotasPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-[13px] text-texto-3">Académico / Bitácora de notas</p>
        <h1 className="text-[28px] font-semibold text-texto">Bitácora de notas</h1>
        <p className="text-[15px] text-texto-2">
          Cada cambio de nota con quién lo hizo, cuándo y su valor anterior y nuevo. Los registros son inmutables.
        </p>
      </div>
      <BitacoraNotas />
      <Alerta tipo="info" titulo="Registros inmutables">
        Ningún usuario puede editar ni eliminar entradas de la bitácora. Cualquier intento de modificación directa es
        rechazado por el sistema.
      </Alerta>
    </div>
  );
}
