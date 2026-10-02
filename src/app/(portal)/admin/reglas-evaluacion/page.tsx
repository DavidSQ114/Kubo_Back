// AD-05 · Reglas de evaluación
"use client";

import { PaginaModulo } from "@/components/portal/PaginaModulo";
import { API } from "@/lib/rutasApi";

export default function ReglasEvaluacionPage() {
  return (
    <PaginaModulo
      migas="Configuración / Reglas de evaluación"
      titulo="Reglas de evaluación"
      descripcion="Consolidación de notas por competencia y parámetros de cierre de bimestre."
      endpoint={API.academico.reglasConsolidacion}
    />
  );
}
