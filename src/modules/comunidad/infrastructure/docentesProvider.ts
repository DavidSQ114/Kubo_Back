// comunidad implementa el puerto DocentesProvider que académico necesita para los tutores de sección (US08)
// y para asignar cursos a docentes (US14).
import type { DocentesProvider } from "@/modules/academico";
import { resumenDocente } from "../application/docentes";
import { docentes } from "./repositorio";

export const docentesProviderComunidad: DocentesProvider = {
  async docentesPorId(ids) {
    return (await docentes.porIds(ids)).map(resumenDocente);
  },
  async docentePorPersona(personaId) {
    const d = await docentes.porPersona(personaId);
    return d ? resumenDocente(d) : null;
  },
};
