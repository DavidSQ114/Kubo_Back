// comunidad/application: «Mi perfil» (bloque M1, todos los roles): datos de la persona en sesión con su DNI
// enmascarado, su correo de acceso, sus roles y su último ingreso, y el cambio de su teléfono y su dirección con
// auditoría ACTUALIZAR_PERFIL en la misma transacción. El correo y el DNI solo los cambia el administrador.
import { prisma } from "@/platform/db/prisma";
import { registrarAuditoria } from "@/platform/auditoria";
import { errores } from "@/platform/http/errores";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { cuentaDePersona, type Autenticado, type Rol } from "@/modules/identidad";
import { enmascararDni } from "../domain/edicion";
import { cambiosDePerfilPropio, type DatosPerfilPropio } from "../domain/perfil";
import { edicionPersonas, rolesActivos } from "../infrastructure/repositorio";

export interface MiPerfil {
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  /** Solo los dos últimos dígitos: «******78». */
  dni: string;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  roles: Rol[];
  rolActivo: Rol;
  ultimoAccesoEn: Date | null;
}

export async function miPerfil(auth: Autenticado): Promise<MiPerfil> {
  const [p, cuenta] = await Promise.all([edicionPersonas.porId(auth.personaId), cuentaDePersona(auth.personaId)]);
  if (!p) throw errores.noEncontrado("Tu perfil");
  return {
    nombres: p.nombres,
    apellidos: p.apellidos,
    nombreCompleto: `${p.nombres} ${p.apellidos}`,
    dni: enmascararDni(p.dni),
    email: cuenta?.email ?? p.email,
    telefono: p.telefono,
    direccion: p.direccion,
    roles: rolesActivos(p),
    rolActivo: auth.rol,
    ultimoAccesoEn: cuenta?.ultimoAccesoEn ?? null,
  };
}

/** Cambia el teléfono y la dirección de la persona en sesión. Sin cambios, no escribe ni audita. */
export async function actualizarMiPerfil(
  auth: Autenticado,
  datos: DatosPerfilPropio,
  meta: MetaSolicitud,
): Promise<MiPerfil> {
  await prisma.$transaction(async (tx) => {
    await edicionPersonas.bloquearFila(tx, auth.personaId);
    const p = await edicionPersonas.porId(auth.personaId, tx);
    if (!p) throw errores.noEncontrado("Tu perfil");
    const { anterior, nuevo } = cambiosDePerfilPropio({ telefono: p.telefono, direccion: p.direccion }, datos);
    if (!Object.keys(nuevo).length) return;
    await edicionPersonas.actualizar(auth.personaId, nuevo, tx);
    await registrarAuditoria(
      tx,
      {
        usuarioId: auth.usuarioId,
        entidad: "persona",
        entidadId: auth.personaId,
        accion: "ACTUALIZAR_PERFIL",
        anterior,
        nuevo,
      },
      meta,
    );
  });
  return miPerfil(auth);
}
