// academico/application: montos de matrícula y pensión del año (requisito de US21, AD-10) y sección bloqueada para
// matricular (US18). El módulo matricula los usa por el index.ts para confirmar la matrícula y generar el cronograma.
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import { registrarAuditoria } from "@/platform/auditoria";
import { ErrorApp } from "@/platform/http/errores";
import type { MetaSolicitud } from "@/platform/http/ruta";
import type { Autenticado } from "@/modules/identidad";
import {
  CLAVE_MONTO_MATRICULA,
  CLAVE_MONTO_PENSION,
  montoGuardado,
  normalizarMonto,
  verificarMontosEditables,
  type MontosAnio,
} from "../domain/montos";
import { anios, bloquearSeccionParaMatricula, parametros } from "../infrastructure/repositorio";

const CLAVES = [CLAVE_MONTO_MATRICULA, CLAVE_MONTO_PENSION];

const noEncontrado = () => new ErrorApp("NO_ENCONTRADO", "El año académico no existe.", 404);

const leerMontos = (valores: Record<string, unknown>): MontosAnio => ({
  montoMatricula: montoGuardado(valores[CLAVE_MONTO_MATRICULA]),
  montoPension: montoGuardado(valores[CLAVE_MONTO_PENSION]),
});

/**
 * Montos propios del año. Sin montos el año no admite matrículas (US18). `sugeridos` son los parámetros generales
 * del seed, solo para precargar el formulario: no cuentan como montos del año.
 */
export async function montosDelAnio(anioAcademicoId: string, db: Tx | typeof prisma = prisma) {
  const anio = await anios.porId(anioAcademicoId, db);
  if (!anio) throw noEncontrado();
  const [propios, generales] = await Promise.all([
    parametros.delAnio(anioAcademicoId, CLAVES, db),
    parametros.generales(CLAVES, db),
  ]);
  const montos = leerMontos(propios);
  return {
    anioAcademicoId,
    anio: anio.anio,
    ...montos,
    configurados: Boolean(montos.montoMatricula && montos.montoPension),
    sugeridos: leerMontos(generales),
  };
}

/** Guarda los dos montos del año (solo Administrador) y registra GUARDAR_MONTOS_ANIO con los valores anteriores. */
export async function guardarMontos(
  admin: Autenticado,
  anioAcademicoId: string,
  datos: { montoMatricula: string; montoPension: string },
  meta: MetaSolicitud,
) {
  const nuevos = {
    montoMatricula: normalizarMonto(datos.montoMatricula),
    montoPension: normalizarMonto(datos.montoPension),
  };
  await prisma.$transaction(async (tx) => {
    await anios.bloquearFila(tx, anioAcademicoId);
    const anio = await anios.porId(anioAcademicoId, tx);
    if (!anio) throw noEncontrado();
    verificarMontosEditables(anio.estado);
    const anteriores = leerMontos(await parametros.delAnio(anioAcademicoId, CLAVES, tx));
    const base = { anioAcademicoId, actualizadoPorId: admin.usuarioId };
    await parametros.guardar(
      {
        ...base,
        clave: CLAVE_MONTO_MATRICULA,
        valor: nuevos.montoMatricula,
        descripcion: `Cuota de matrícula ${anio.anio} (S/)`,
      },
      tx,
    );
    await parametros.guardar(
      {
        ...base,
        clave: CLAVE_MONTO_PENSION,
        valor: nuevos.montoPension,
        descripcion: `Pensión mensual ${anio.anio} (S/)`,
      },
      tx,
    );
    await registrarAuditoria(
      tx,
      {
        usuarioId: admin.usuarioId,
        entidad: "anio_academico",
        entidadId: anioAcademicoId,
        accion: "GUARDAR_MONTOS_ANIO",
        anterior: anteriores,
        nuevo: nuevos,
      },
      meta,
    );
  });
  return montosDelAnio(anioAcademicoId);
}

/**
 * Dentro de la transacción de la matrícula: bloquea la fila de la sección (SELECT … FOR UPDATE) y la devuelve, o
 * null si no existe. Quien llama cuenta las matrículas vigentes después del bloqueo.
 */
export const seccionBloqueadaParaMatricula = (tx: Tx, seccionId: string) => bloquearSeccionParaMatricula(tx, seccionId);
