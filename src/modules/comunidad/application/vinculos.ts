// comunidad/application: vincular un apoderado con un estudiante (US15 «Vincular a un estudiante», US17, RF13).
// El parentesco, el apoderado principal y la autorización se piden al vincular: pertenecen al vínculo.
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import { registrarAuditoria } from "@/platform/auditoria";
import type { MetaSolicitud } from "@/platform/http/ruta";
import type { Autenticado } from "@/modules/identidad";
import { erroresComunidad as E } from "../domain/errores";
import { planVinculoNuevo, type Parentesco } from "../domain/vinculos";
import { apoderados, estudiantes, vinculos } from "../infrastructure/repositorio";

export interface DatosVinculo {
  estudianteId: string;
  apoderadoId: string;
  parentesco: Parentesco;
  esPrincipal: boolean;
  autorizado: boolean;
}

/**
 * Dentro de una transacción: agrega el vínculo a un estudiante que ya existe, dejando siempre un solo principal
 * (bloquea la fila del estudiante para que dos vínculos simultáneos no queden ambos como principales).
 * Registra VINCULAR_APODERADO con el principal anterior si cambió.
 */
export async function vincularEnTx(tx: Tx, admin: Autenticado, datos: DatosVinculo, meta: MetaSolicitud) {
  await estudiantes.bloquearFila(tx, datos.estudianteId);
  if (!(await estudiantes.activoPorId(datos.estudianteId, tx))) throw E.estudianteNoEncontrado();

  const plan = planVinculoNuevo(await vinculos.deEstudiante(datos.estudianteId, tx), datos);
  if (plan.quitarPrincipalA) await vinculos.quitarPrincipal(plan.quitarPrincipalA, tx);
  const v = await vinculos.crear({ ...datos, esPrincipal: plan.esPrincipal }, tx);

  await registrarAuditoria(
    tx,
    {
      usuarioId: admin.usuarioId,
      entidad: "vinculo_apoderado",
      entidadId: v.id,
      accion: "VINCULAR_APODERADO",
      anterior: plan.quitarPrincipalA ? { principalAnteriorVinculoId: plan.quitarPrincipalA } : undefined,
      nuevo: { ...datos, esPrincipal: plan.esPrincipal },
    },
    meta,
  );
  return { vinculoId: v.id, esPrincipal: plan.esPrincipal, cambioPrincipal: Boolean(plan.quitarPrincipalA) };
}

/** Vincula un apoderado ya registrado con un estudiante ya registrado (POST /comunidad/vinculos). */
export async function vincularApoderado(admin: Autenticado, datos: DatosVinculo, meta: MetaSolicitud) {
  return prisma.$transaction(async (tx) => {
    if (!(await apoderados.activosPorIds([datos.apoderadoId], tx)).length) throw E.apoderadoNoEncontrado();
    return vincularEnTx(tx, admin, datos, meta);
  });
}
