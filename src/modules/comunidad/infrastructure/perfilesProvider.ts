// comunidad implementa el puerto PerfilesProvider que identidad necesita para el login.
import type { PerfilesProvider } from "@/modules/identidad";
import { personas, rolesActivos } from "./repositorio";

export const perfilesProviderComunidad: PerfilesProvider = {
  async perfilesActivos(personaId) {
    const p = await personas.conPerfiles(personaId);
    if (!p || !p.activo) return [];
    return rolesActivos(p);
  },
  async datosPersona(personaId) {
    const p = await personas.conPerfiles(personaId);
    return p ? { personaId: p.id, nombres: p.nombres, apellidos: p.apellidos } : null;
  },
};
