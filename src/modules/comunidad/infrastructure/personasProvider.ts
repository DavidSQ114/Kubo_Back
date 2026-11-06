// comunidad implementa el puerto PersonasProvider de académico: nombre corto del responsable de cada versión de
// la regla de consolidación (US12, AD-05).
import type { PersonasProvider } from "@/modules/academico";
import { personas } from "./repositorio";

export const personasProviderComunidad: PersonasProvider = {
  async nombresCortos(personaIds) {
    const filas = await personas.porIds(personaIds);
    return Object.fromEntries(filas.map((p) => [p.id, `${p.nombres.split(" ")[0]} ${p.apellidos.split(" ")[0]}`]));
  },
};
