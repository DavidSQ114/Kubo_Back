// academico/puertos: lo que académico necesita de módulos superiores, sin importarlos.
// evaluacion (dueño de cierre_calificacion) implementa CierresProvider y src/server/wiring.ts lo conecta.

export interface ResumenCierres {
  total: number;
  publicados: number;
}

export interface CierresProvider {
  /** Cuántos cierres de calificación tienen los periodos del año y cuántos están PUBLICADOS (US06, cerrar año). */
  resumenCierres(anioAcademicoId: string): Promise<ResumenCierres>;
}

let cierres: CierresProvider | null = null;

export function configurarCierresProvider(p: CierresProvider) {
  cierres = p;
}

export function cierresProvider(): CierresProvider {
  if (!cierres) {
    throw new Error("CierresProvider no configurado: falta importar '@/server/wiring' en la ruta");
  }
  return cierres;
}
