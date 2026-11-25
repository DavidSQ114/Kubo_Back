// evaluacion/application: recálculo de las notas de las competencias con ítems de evaluación (bloque M2). Lo usan el
// guardado de calificaciones (PUT …/notas) y la gestión de ítems (PUT …/items), dentro de su transacción: crea,
// cambia o quita la nota de cada alumno y deja cada cambio en la bitácora de notas con el origen ITEMS (US03).
import type { Tx } from "@/platform/db/tipos";
import { consolidarLogro, type ReglaCalculo } from "@/modules/academico";
import type { CalcularNota, CambiosPorItems } from "../domain/items";
import type { LogroNota } from "../domain/notas";
import type { CompetenciaDeColumna } from "../domain/rectificacion";
import { notas } from "../infrastructure/repositorio";
import { registrarEnBitacora, type CambioDeNota, type ContextoBitacora } from "./bitacora";

/** La regla PONDERADO de académico (AD=4 … C=1, MITAD_HACIA_ARRIBA): la misma función, no una copia. */
const REGLA_ITEMS: ReglaCalculo = { metodo: "PONDERADO", criterioDesempate: "MAYOR_JERARQUIA" };

export const calcularNotaDeItems: CalcularNota = (valores, pesos) => consolidarLogro(valores, REGLA_ITEMS, pesos);

export interface ResumenRecalculo {
  calculadas: number;
  cambiadas: number;
  quitadas: number;
}

/**
 * Aplica el recálculo en la transacción del cierre ya bloqueado: notas nuevas, cambiadas (con su valor anterior) y
 * quitadas, cada una con su fila en la bitácora (origen ITEMS; una nota quitada queda con logro nuevo null).
 */
export async function aplicarRecalculo(
  tx: Tx,
  datos: {
    cierreId: string;
    cambios: CambiosPorItems;
    usuarioId: string;
    contexto: Omit<ContextoBitacora, "origen" | "solicitudId">;
    nombres: Map<string, string>;
    columnas: Map<string, CompetenciaDeColumna>;
  },
): Promise<ResumenRecalculo> {
  const { cambios, cierreId } = datos;
  const creadas = cambios.crear.length ? await notas.crear(tx, cierreId, cambios.crear, datos.usuarioId) : [];
  for (const c of cambios.cambiar) {
    await notas.cambiar(tx, c.id, { logro: c.logro, logroAnterior: c.anterior, modificadoPorId: datos.usuarioId });
  }
  await notas.eliminar(
    tx,
    cambios.quitar.map((q) => q.id),
  );
  const cambio = (
    n: { id: string; matriculaId: string; competenciaPlanId: string },
    anterior: LogroNota | null,
    nuevo: LogroNota | null,
  ): CambioDeNota => ({
    notaId: n.id,
    cierreId,
    matriculaId: n.matriculaId,
    competenciaPlanId: n.competenciaPlanId,
    anterior,
    nuevo,
    estudiante: datos.nombres.get(n.matriculaId) ?? "",
    competencia: datos.columnas.get(n.competenciaPlanId)!,
  });
  await registrarEnBitacora(tx, { ...datos.contexto, origen: "ITEMS", solicitudId: null }, [
    ...creadas.map((n) => cambio(n, null, n.logro)),
    ...cambios.cambiar.map((c) => cambio(c, c.anterior, c.logro)),
    ...cambios.quitar.map((q) => cambio(q, q.anterior, null)),
  ]);
  return { calculadas: creadas.length, cambiadas: cambios.cambiar.length, quitadas: cambios.quitar.length };
}
