// AD-02 · Año y bimestres
"use client";

import { BloqueApi } from "@/components/portal/BloqueApi";
import { EncabezadoPagina } from "@/components/portal/PaginaModulo";
import { API } from "@/lib/rutasApi";

export default function AnioBimestresPage() {
  return (
    <>
      <EncabezadoPagina
        migas="Configuración / Año y bimestres"
        titulo="Año y bimestres"
        descripcion="Define el año lectivo y los periodos de evaluación (bimestres) en curso."
      />
      <BloqueApi titulo="Años académicos" endpoint={API.academico.anios} />
      <BloqueApi titulo="Periodos de evaluación" endpoint={API.academico.periodos} />
    </>
  );
}
