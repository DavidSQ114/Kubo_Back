// AD-04b · Catálogo oficial
"use client";

import Link from "next/link";
import { PaginaModulo } from "@/components/portal/PaginaModulo";
import { Boton } from "@/components/ui";
import { API } from "@/lib/rutasApi";

export default function CatalogoOficialPage() {
  return (
    <PaginaModulo
      migas="Configuración / Cursos / Catálogo oficial"
      titulo="Catálogo oficial"
      descripcion="Referencia de cursos y competencias oficiales para el plan de estudios."
      endpoint={API.academico.catalogoOficial}
      acciones={
        <Link href="/admin/cursos">
          <Boton variante="secundario">Volver a cursos</Boton>
        </Link>
      }
    />
  );
}
