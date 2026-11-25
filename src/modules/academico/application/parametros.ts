// academico/application: «Parámetros del sistema» del Administrador (bloque M1). Lista los parámetros generales de
// parametro_institucion con su descripción y los actualiza validando su tipo (hora, entero, proporción o monto), con
// auditoría ACTUALIZAR_PARAMETRO (valor anterior y nuevo) en la misma transacción.
import { prisma } from "@/platform/db/prisma";
import { registrarAuditoria } from "@/platform/auditoria";
import type { MetaSolicitud } from "@/platform/http/ruta";
import type { Autenticado } from "@/modules/identidad";
import { montoGuardado } from "../domain/montos";
import { PARAMETROS_SISTEMA, valorDeParametro, verificarCoherencia, type TipoParametro } from "../domain/parametros";
import { erroresAcademico as E } from "../domain/errores";
import { parametros } from "../infrastructure/repositorio";

export interface ParametroSistema {
  clave: string;
  grupo: string;
  tipo: TipoParametro;
  descripcion: string;
  /** Valor como se muestra y se edita: «07:30», «5», «0.15» o «350.00»; null si aún no está configurado. */
  valor: string | null;
  minimo: number | null;
  maximo: number | null;
  actualizadoEn: Date | null;
}

const CLAVES = Object.keys(PARAMETROS_SISTEMA);

/** Texto para mostrar el valor guardado en el JSON del parámetro. */
function aTexto(tipo: TipoParametro, valor: unknown): string | null {
  if (valor == null) return null;
  if (tipo === "MONTO") return montoGuardado(valor);
  return typeof valor === "string" || typeof valor === "number" ? String(valor) : null;
}

/** Parámetros generales editables, en el orden del catálogo (agrupados por tema). */
export async function listarParametrosSistema(): Promise<ParametroSistema[]> {
  const filas = new Map((await parametros.sistema(CLAVES)).map((f) => [f.clave, f]));
  return CLAVES.map((clave) => {
    const def = PARAMETROS_SISTEMA[clave];
    const fila = filas.get(clave);
    return {
      clave,
      grupo: def.grupo,
      tipo: def.tipo,
      descripcion: fila?.descripcion ?? def.descripcion,
      valor: aTexto(def.tipo, fila?.valor),
      minimo: def.minimo ?? null,
      maximo: def.maximo ?? null,
      actualizadoEn: fila?.updatedAt ?? null,
    };
  });
}

/**
 * Cambia un parámetro general. El texto se valida según su tipo (PARAMETRO_INVALIDO con un mensaje claro) y con el
 * parámetro que lo acompaña (la hora de inicio antes que la límite, el aviso previo menor que la alerta).
 */
export async function actualizarParametroSistema(
  admin: Autenticado,
  clave: string,
  datos: { valor: string },
  meta: MetaSolicitud,
): Promise<ParametroSistema> {
  const def = PARAMETROS_SISTEMA[clave];
  if (!def) throw E.parametroNoEditable(clave);
  const valor = valorDeParametro(clave, datos.valor);

  await prisma.$transaction(async (tx) => {
    await parametros.bloquearGeneral(tx, clave);
    const vigentes = Object.fromEntries((await parametros.sistema(CLAVES, tx)).map((f) => [f.clave, f.valor]));
    verificarCoherencia(clave, valor, vigentes);
    const anterior = vigentes[clave] ?? null;
    const fila = await parametros.guardarGeneral(
      { clave, valor, descripcion: def.descripcion, actualizadoPorId: admin.usuarioId },
      tx,
    );
    await registrarAuditoria(
      tx,
      {
        usuarioId: admin.usuarioId,
        entidad: "parametro_institucion",
        entidadId: fila.id,
        accion: "ACTUALIZAR_PARAMETRO",
        anterior: { clave, valor: anterior },
        nuevo: { clave, valor },
      },
      meta,
    );
  });

  const actualizado = (await listarParametrosSistema()).find((p) => p.clave === clave);
  return actualizado!;
}
