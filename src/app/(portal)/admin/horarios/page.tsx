// AD-13 · Matriz de horarios
"use client";

import Link from "next/link";
import { PaginaModulo } from "@/components/portal/PaginaModulo";
import { Boton } from "@/components/ui";
import { API } from "@/lib/rutasApi";

export default function HorariosPage() {
  return (
    <PaginaModulo
      migas="Académico / Horarios"
      titulo="Matriz de horarios"
      descripcion="Cuadrícula de horarios por sección y asignación docente."
      endpoint={API.horarios.matriz}
      acciones={
        <>
          <Link href="/admin/horarios/importar">
            <Boton variante="secundario">Importar CSV (AD-17)</Boton>
          </Link>
          <Boton variante="secundario" disabled title="M-06 · asignar clase">
            Asignar clase
          </Boton>
        </>
      }
    />
  );
}
