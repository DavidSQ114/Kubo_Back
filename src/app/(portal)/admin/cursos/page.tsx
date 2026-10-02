// AD-04 · Cursos y competencias
"use client";

import Link from "next/link";
import { PaginaModulo } from "@/components/portal/PaginaModulo";
import { Boton } from "@/components/ui";
import { API } from "@/lib/rutasApi";

export default function CursosPage() {
  return (
    <PaginaModulo
      migas="Configuración / Cursos y competencias"
      titulo="Cursos y competencias"
      descripcion="Plan de estudios, cursos por grado y competencias del CNEB."
      endpoint={API.academico.cursos}
      acciones={
        <Link href="/admin/cursos/catalogo">
          <Boton variante="secundario">Catálogo oficial (AD-04b)</Boton>
        </Link>
      }
    />
  );
}
