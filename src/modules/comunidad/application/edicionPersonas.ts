// comunidad/application: detalle, edición, historial de cambios y baja de una persona (US69, AD-06).
// Corrige datos mal escritos (por ejemplo, el correo de un apoderado) dejando en la bitácora el valor anterior y el
// nuevo de cada campo. La cuenta es de identidad: el correo de acceso y las sesiones se cambian por su index.ts.
import { prisma } from "@/platform/db/prisma";
import { esDuplicado, type Tx } from "@/platform/db/tipos";
import { eventosDeAuditoria, registrarAuditoria } from "@/platform/auditoria";
import { errores } from "@/platform/http/errores";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { registrosDeDocente } from "@/modules/academico";
import {
  avisarCambioDeCorreo,
  cambiarCorreoDeCuenta,
  cerrarSesionesDePersona,
  cuentaDePersona,
  eliminarCuentaSinUso,
  type Autenticado,
  type CuentaDePersona,
  type EstadoUsuario,
  type Rol,
} from "@/modules/identidad";
import {
  cambiosDePersona,
  enmascararDni,
  planDeBaja,
  resumenDeEvento,
  valoresDeAuditoria,
  verificarEdicion,
  type CambioCampo,
  type DatosEditables,
  type RegistrosDePersona,
} from "../domain/edicion";
import { erroresComunidad as E } from "../domain/errores";
import { fechaSinHora } from "../domain/vinculos";
import {
  edicionPersonas,
  rolesActivos,
  type DatosPersonaEditada,
  type PersonaEdicion,
} from "../infrastructure/repositorio";
import { registrosMatriculaProvider } from "../puertos";
import { nombresDeUsuarios } from "./estudiantesMatricula";

/** Eventos que se muestran en el historial de una persona. */
const ACCIONES_HISTORIAL = ["EDITAR_PERSONA", "DESACTIVAR_PERFIL"];
const LIMITE_HISTORIAL = 50;

export interface DetallePersona extends DatosEditables {
  personaId: string;
  nombreCompleto: string;
  /** Perfiles activos. */
  perfiles: Rol[];
  /** Perfiles registrados, activos o no: definen qué datos de perfil se pueden editar. */
  perfilesRegistrados: Rol[];
  cuenta: { usuarioId: string; estado: EstadoUsuario; usada: boolean } | null;
}

/** Datos de un PATCH: solo los campos que cambian y, si cambian el DNI o los nombres, el motivo. */
export type DatosEdicion = Partial<DatosEditables> & { motivo?: string | null };

const perfilesRegistrados = (p: PersonaEdicion): Rol[] => {
  const roles: Rol[] = [];
  if (p.administrador) roles.push("ADMINISTRADOR");
  if (p.docente) roles.push("DOCENTE");
  if (p.apoderado) roles.push("APODERADO");
  if (p.estudiante) roles.push("ALUMNO");
  return roles;
};

/** El correo vigente es el de la cuenta; sin cuenta, el de la persona. */
const datosEditables = (p: PersonaEdicion, cuenta: CuentaDePersona | null): DatosEditables => ({
  dni: p.dni,
  nombres: p.nombres,
  apellidos: p.apellidos,
  email: cuenta?.email ?? p.email,
  telefono: p.telefono,
  direccion: p.direccion,
  fechaNacimiento: p.fechaNacimiento ? p.fechaNacimiento.toISOString().slice(0, 10) : null,
  sexo: p.sexo,
  ocupacion: p.apoderado?.ocupacion ?? null,
  especialidad: p.docente?.especialidad ?? null,
  colegioProcedencia: p.estudiante?.colegioProcedencia ?? null,
});

async function personaConCuenta(personaId: string, tx?: Tx) {
  const persona = await edicionPersonas.porId(personaId, tx);
  if (!persona) throw errores.noEncontrado("La persona");
  return { persona, cuenta: await cuentaDePersona(personaId, tx) };
}

/** Datos de la persona para el detalle y el formulario de edición de AD-06. */
export async function detallePersona(personaId: string): Promise<DetallePersona> {
  const { persona, cuenta } = await personaConCuenta(personaId);
  return {
    personaId: persona.id,
    nombreCompleto: `${persona.nombres} ${persona.apellidos}`,
    ...datosEditables(persona, cuenta),
    perfiles: rolesActivos(persona),
    perfilesRegistrados: perfilesRegistrados(persona),
    cuenta: cuenta ? { usuarioId: cuenta.usuarioId, estado: cuenta.estado, usada: cuenta.usada } : null,
  };
}

const nuevoValor = (cambios: CambioCampo[], campo: keyof DatosEditables) => cambios.find((c) => c.campo === campo);

/** Columnas de persona que cambian (el resto de los cambios son datos de un perfil). */
function datosDePersona(cambios: CambioCampo[]): DatosPersonaEditada {
  const datos: DatosPersonaEditada = {};
  for (const c of cambios) {
    if (c.campo === "fechaNacimiento") datos.fechaNacimiento = c.nuevo ? fechaSinHora(c.nuevo) : null;
    else if (c.campo === "sexo") datos.sexo = c.nuevo as DatosPersonaEditada["sexo"];
    else if (c.campo === "dni" || c.campo === "nombres" || c.campo === "apellidos") datos[c.campo] = c.nuevo ?? "";
    else if (c.campo === "email" || c.campo === "telefono" || c.campo === "direccion") datos[c.campo] = c.nuevo;
  }
  return datos;
}

async function guardarCambios(tx: Tx, personaId: string, cambios: CambioCampo[]) {
  const dni = nuevoValor(cambios, "dni")?.nuevo;
  if (dni && (await edicionPersonas.idPorDni(dni, tx))) throw E.dniYaRegistrado();

  const email = nuevoValor(cambios, "email")?.nuevo;
  let correoDeCuenta: Awaited<ReturnType<typeof cambiarCorreoDeCuenta>> = null;
  if (email) {
    if (await edicionPersonas.otraConEmail(email, personaId, tx)) throw E.emailEnUso();
    correoDeCuenta = await cambiarCorreoDeCuenta(tx, { personaId, email });
  }

  const persona = datosDePersona(cambios);
  if (Object.keys(persona).length) await edicionPersonas.actualizar(personaId, persona, tx);
  const ocupacion = nuevoValor(cambios, "ocupacion")?.nuevo;
  if (ocupacion) await edicionPersonas.actualizarApoderado(personaId, ocupacion, tx);
  const especialidad = nuevoValor(cambios, "especialidad")?.nuevo;
  if (especialidad) await edicionPersonas.actualizarDocente(personaId, especialidad, tx);
  const colegio = nuevoValor(cambios, "colegioProcedencia");
  if (colegio) await edicionPersonas.actualizarEstudiante(personaId, colegio.nuevo, tx);
  return correoDeCuenta;
}

/**
 * Edita los datos de una persona (US69). Solo se guardan los campos enviados que cambian; sin cambios no escribe nada.
 * - Correo: no puede ser el de otra persona ni el de otra cuenta (409 EMAIL_EN_USO). Si la persona tiene cuenta, su
 *   correo de acceso cambia en la misma transacción y se cierran sus sesiones; después de confirmar se avisa al correo
 *   nuevo y al anterior, y un envío fallido no revierte el cambio.
 * - DNI, nombres y apellidos: exigen motivo (422 MOTIVO_REQUERIDO) y el DNI nuevo no puede existir (409).
 * - Auditoría EDITAR_PERSONA con el valor anterior y el nuevo de cada campo (el DNI, enmascarado) y el motivo.
 */
export async function editarPersona(admin: Autenticado, personaId: string, datos: DatosEdicion, meta: MetaSolicitud) {
  const { motivo, ...enviados } = datos;
  let resultado;
  try {
    resultado = await prisma.$transaction(async (tx) => {
      await edicionPersonas.bloquearFila(tx, personaId);
      const { persona, cuenta } = await personaConCuenta(personaId, tx);
      const cambios = cambiosDePersona(datosEditables(persona, cuenta), enviados);
      verificarEdicion(cambios, { perfiles: perfilesRegistrados(persona), tieneCuenta: Boolean(cuenta), motivo });
      if (!cambios.length) return { persona, cambios, correoDeCuenta: null };

      const correoDeCuenta = await guardarCambios(tx, personaId, cambios);
      await registrarAuditoria(
        tx,
        {
          usuarioId: admin.usuarioId,
          entidad: "persona",
          entidadId: personaId,
          accion: "EDITAR_PERSONA",
          ...valoresDeAuditoria(cambios),
          motivo: motivo?.trim() || null,
        },
        meta,
      );
      return { persona, cambios, correoDeCuenta };
    });
  } catch (e) {
    // Dos operaciones simultáneas con el mismo correo o DNI: el índice único rechaza la segunda.
    if (esDuplicado(e, "email")) throw E.emailEnUso();
    if (esDuplicado(e, "dni")) throw E.dniYaRegistrado();
    throw e;
  }

  const { persona, cambios, correoDeCuenta } = resultado;
  const nombres = nuevoValor(cambios, "nombres")?.nuevo ?? persona.nombres;
  const apellidos = nuevoValor(cambios, "apellidos")?.nuevo ?? persona.apellidos;
  const avisos = correoDeCuenta ? await avisarCambioDeCorreo({ nombres, ...correoDeCuenta }) : null;
  return {
    personaId,
    nombreCompleto: `${nombres} ${apellidos}`,
    cambios: cambios.map((c) => c.campo),
    /** Cambió el correo con el que ingresa: se cerraron sus sesiones. */
    sesionesCerradas: Boolean(correoDeCuenta),
    /** Si salió el aviso al correo nuevo y al anterior; null si no cambió el correo de una cuenta. */
    avisos,
  };
}

export interface EventoHistorial {
  id: string;
  accion: string;
  fecha: Date;
  /** Quién hizo el cambio; null si su cuenta ya no existe. */
  responsable: string | null;
  motivo: string | null;
  cambios: CambioCampo[];
  perfil: Rol | null;
}

/** Historial de cambios de la persona, leído de la bitácora (del más reciente al más antiguo). */
export async function historialPersona(personaId: string): Promise<{ items: EventoHistorial[] }> {
  if (!(await edicionPersonas.porId(personaId))) throw errores.noEncontrado("La persona");
  const eventos = await eventosDeAuditoria({
    entidad: "persona",
    entidadIds: [personaId],
    acciones: ACCIONES_HISTORIAL,
    limite: LIMITE_HISTORIAL,
  });
  const responsables = await nombresDeUsuarios(eventos.flatMap((e) => (e.usuarioId ? [e.usuarioId] : [])));
  return {
    items: eventos.map((e) => ({
      id: e.id,
      accion: e.accion,
      fecha: e.fecha,
      responsable: e.usuarioId ? (responsables[e.usuarioId]?.nombreCompleto ?? null) : null,
      motivo: e.motivo,
      ...resumenDeEvento(e.accion, e.valorAnterior, e.valorNuevo),
    })),
  };
}

async function registrosDePersona(
  tx: Tx,
  persona: PersonaEdicion,
  cuenta: CuentaDePersona | null,
): Promise<RegistrosDePersona> {
  const deMatricula = persona.estudiante
    ? await registrosMatriculaProvider().registrosDeEstudiante(tx, persona.estudiante.id)
    : { matriculas: 0, pagos: 0 };
  return {
    cuentaUsada: Boolean(cuenta?.usada),
    vinculos: (persona.apoderado?._count.vinculosApoderado ?? 0) + (persona.estudiante?._count.vinculosApoderado ?? 0),
    ...deMatricula,
    asignaciones: persona.docente ? await registrosDeDocente(persona.docente.id, tx) : 0,
  };
}

/**
 * Da de baja a una persona (US69). Sin cuenta usada, vínculos, matrículas, pagos ni asignaciones se elimina con sus
 * perfiles y su cuenta sin usar (auditoría ELIMINAR_PERSONA). Con alguno de esos registros se desactivan sus perfiles
 * activos, o solo `perfil`, y se cierran sus sesiones (una auditoría DESACTIVAR_PERFIL por perfil).
 */
export async function eliminarPersona(
  admin: Autenticado,
  personaId: string,
  opciones: { perfil?: Rol },
  meta: MetaSolicitud,
) {
  return prisma.$transaction(async (tx) => {
    await edicionPersonas.bloquearFila(tx, personaId);
    const { persona, cuenta } = await personaConCuenta(personaId, tx);
    const plan = planDeBaja({
      esPropia: personaId === admin.personaId,
      perfilesActivos: rolesActivos(persona),
      perfil: opciones.perfil,
      registros: await registrosDePersona(tx, persona, cuenta),
    });
    const nombreCompleto = `${persona.nombres} ${persona.apellidos}`;
    const evento = { usuarioId: admin.usuarioId, entidad: "persona", entidadId: personaId };

    if (plan.accion === "ELIMINAR") {
      const cuentaEliminada = await eliminarCuentaSinUso(tx, personaId);
      await edicionPersonas.eliminar(personaId, tx);
      const anterior = {
        dni: enmascararDni(persona.dni),
        nombres: persona.nombres,
        apellidos: persona.apellidos,
        perfiles: perfilesRegistrados(persona),
        cuentaEliminada,
      };
      await registrarAuditoria(tx, { ...evento, accion: "ELIMINAR_PERSONA", anterior }, meta);
      return { resultado: "ELIMINADA" as const, nombreCompleto, perfiles: [] as Rol[], motivos: [] as string[] };
    }

    for (const perfil of plan.perfiles) {
      await edicionPersonas.desactivarPerfil(personaId, perfil, tx);
      await registrarAuditoria(
        tx,
        {
          ...evento,
          accion: "DESACTIVAR_PERFIL",
          anterior: { perfil, activo: true },
          nuevo: { perfil, activo: false, registros: plan.motivos },
        },
        meta,
      );
    }
    await cerrarSesionesDePersona(tx, personaId);
    return { resultado: "PERFIL_DESACTIVADO" as const, nombreCompleto, perfiles: plan.perfiles, motivos: plan.motivos };
  });
}
