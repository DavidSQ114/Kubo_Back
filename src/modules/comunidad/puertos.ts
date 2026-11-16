// comunidad/puertos: lo que comunidad necesita de módulos superiores, sin importarlos.
// matricula implementa MatriculaBorradorProvider y RegistrosMatriculaProvider, y src/server/wiring.ts los conecta al
// arrancar.
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

// ---------- Registros de matrícula de un estudiante (dueño: matricula) ----------

export interface RegistrosMatriculaProvider {
  /**
   * Matrículas del estudiante en cualquier estado y operaciones de pago de sus cuotas (US69): con alguna, la persona
   * no se elimina, solo se desactiva su perfil. Va dentro de la transacción de la baja.
   */
  registrosDeEstudiante(tx: Tx, estudianteId: string): Promise<{ matriculas: number; pagos: number }>;
  /**
   * ¿El estudiante tiene una matrícula vigente («Matriculado» en un año abierto)? Solo con ella se le crea el acceso
   * al portal del alumno (US49). Un retirado o con la matrícula anulada no la tiene.
   */
  tieneMatriculaVigente(tx: Tx, estudianteId: string): Promise<boolean>;
}

let registrosMatricula: RegistrosMatriculaProvider | null = null;

export function configurarRegistrosMatriculaProvider(p: RegistrosMatriculaProvider) {
  registrosMatricula = p;
}

export function registrosMatriculaProvider(): RegistrosMatriculaProvider {
  if (!registrosMatricula) {
    throw new Error("RegistrosMatriculaProvider no configurado: falta importar '@/server/wiring' en la ruta");
  }
  return registrosMatricula;
}
