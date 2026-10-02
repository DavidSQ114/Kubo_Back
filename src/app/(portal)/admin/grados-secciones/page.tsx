// AD-03 · Grados, secciones y aulas
"use client";

import { BloqueApi } from "@/components/portal/BloqueApi";
import { EncabezadoPagina } from "@/components/portal/PaginaModulo";
import { API } from "@/lib/rutasApi";

export default function GradosSeccionesPage() {
  return (
    <>
      <EncabezadoPagina
        migas="Configuración / Grados, secciones y aulas"
        titulo="Grados, secciones y aulas"
        descripcion="Estructura académica: grados, secciones por año y aulas físicas."
      />
      <BloqueApi titulo="Grados" endpoint={API.academico.grados} />
      <BloqueApi titulo="Secciones" endpoint={API.academico.secciones} />
      <BloqueApi titulo="Aulas" endpoint={API.academico.aulas} />
    </>
  );
}
