// comunidad/puertos: lo que comunidad necesita de módulos superiores, sin importarlos.
// matricula implementa MatriculaBorradorProvider y src/server/wiring.ts lo conecta al arrancar.
import type { Tx } from "@/platform/db/tipos";

export interface MatriculaBorrador {
  matriculaId: string;
  anioAcademicoId: string;
  anio: number;
}

export interface MatriculaBorradorProvider {
  /**
   * «Guardar como borrador» (US17): matrícula «En proceso» del estudiante en el año en matrícula, sin sección, sin
   * responsable de pago, sin validar vacantes y sin cronograma. Va dentro de la transacción del registro.
   */
  crearEnProceso(tx: Tx, datos: { estudianteId: string; registradoPorId: string }): Promise<MatriculaBorrador>;
}

let borradores: MatriculaBorradorProvider | null = null;

export function configurarMatriculaBorradorProvider(p: MatriculaBorradorProvider) {
  borradores = p;
}

export function matriculaBorradorProvider(): MatriculaBorradorProvider {
  if (!borradores) {
    throw new Error("MatriculaBorradorProvider no configurado: falta importar '@/server/wiring' en la ruta");
  }
  return borradores;
}
