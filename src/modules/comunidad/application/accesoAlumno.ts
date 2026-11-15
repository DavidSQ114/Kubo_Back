// comunidad/application: acceso del alumno al portal (US49, AD-06 «Crear acceso al portal»). El estudiante se
// registra sin cuenta (US17); aquí el Administrador se la crea con un correo y una contraseña temporal, igual que a
// los apoderados (US15): cambio obligatorio en el primer ingreso, auditoría y correo de bienvenida. La cuenta es de
// identidad y la matrícula vigente la informa matricula por su puerto.
import { prisma } from "@/platform/db/prisma";
import { esDuplicado } from "@/platform/db/tipos";
import { registrarAuditoria } from "@/platform/auditoria";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { asegurarCuenta, cuentaDePersona, enviarBienvenida, type Autenticado } from "@/modules/identidad";
import { verificarAccesoCreable } from "../domain/acceso";
import { erroresComunidad as E } from "../domain/errores";
import { edicionPersonas, estudiantes } from "../infrastructure/repositorio";
import { registrosMatriculaProvider } from "../puertos";

export interface DatosAccesoAlumno {
  /** Correo con el que ingresará el alumno. */
  email: string;
  /** Correo de bienvenida con la contraseña temporal (por defecto, sí). */
  enviarCorreo?: boolean;
}

/**
 * Crea la cuenta de un estudiante (US49). Requisitos: estudiante activo (404), sin cuenta previa (409
 * ACCESO_EXISTENTE), con matrícula vigente (422 SIN_MATRICULA_VIGENTE) y un correo que no use otra persona ni otra
 * cuenta (409 EMAIL_EN_USO). La contraseña temporal se devuelve una sola vez y no se guarda en claro. Todo en una
 * transacción con la auditoría CREAR_ACCESO_ALUMNO; el correo va después y su falla no revierte la cuenta.
 */
export async function crearAccesoAlumno(
  admin: Autenticado,
  estudianteId: string,
  datos: DatosAccesoAlumno,
  urlBase: string,
  meta: MetaSolicitud,
) {
  let resultado;
  try {
    resultado = await prisma.$transaction(async (tx) => {
      const estudiante = await estudiantes.conPersona(estudianteId, tx);
      if (!estudiante) throw E.estudianteNoEncontrado();
      const persona = estudiante.persona;
      // dos administradores creando el acceso a la vez: el segundo espera y encuentra la cuenta ya creada
      await edicionPersonas.bloquearFila(tx, persona.id);
      verificarAccesoCreable({
        estudianteActivo: estudiante.activo && persona.activo,
        tieneCuenta: Boolean(await cuentaDePersona(persona.id, tx)),
        matriculaVigente: await registrosMatriculaProvider().tieneMatriculaVigente(tx, estudiante.id),
      });
      if (await edicionPersonas.otraConEmail(datos.email, persona.id, tx)) throw E.emailEnUso();

      const cuenta = await asegurarCuenta(tx, { personaId: persona.id, email: datos.email });
      // el correo vigente de una persona con cuenta es el de su cuenta (US69)
      if (persona.email !== cuenta.email) await edicionPersonas.actualizar(persona.id, { email: cuenta.email }, tx);
      await registrarAuditoria(
        tx,
        {
          usuarioId: admin.usuarioId,
          entidad: "usuario",
          entidadId: cuenta.usuarioId,
          accion: "CREAR_ACCESO_ALUMNO",
          nuevo: { estudianteId: estudiante.id, personaId: persona.id, estado: "PENDIENTE_ACTIVACION" },
        },
        meta,
      );
      return { persona, cuenta };
    });
  } catch (e) {
    if (esDuplicado(e, "email")) throw E.emailEnUso();
    if (esDuplicado(e, "persona_id")) throw E.accesoExistente();
    throw e;
  }

  const { persona, cuenta } = resultado;
  let correoEnviado = false;
  if (cuenta.passwordTemporal && datos.enviarCorreo !== false) {
    correoEnviado = await enviarBienvenida({
      email: cuenta.email,
      nombres: persona.nombres,
      passwordTemporal: cuenta.passwordTemporal,
      urlBase,
    });
  }
  return {
    estudianteId,
    personaId: persona.id,
    usuarioId: cuenta.usuarioId,
    nombreCompleto: `${persona.nombres} ${persona.apellidos}`,
    email: cuenta.email,
    correoEnviado,
    // Se muestra una sola vez al administrador por si el correo no llega. No se guarda en ningún lugar.
    passwordTemporal: cuenta.passwordTemporal,
  };
}

export interface EstudianteEnSesion {
  estudianteId: string;
  nombres: string;
  apellidos: string;
}

/** Perfil de estudiante activo de la persona en sesión (portal del alumno, US49), o null si no lo tiene. */
export async function estudianteDePersona(personaId: string): Promise<EstudianteEnSesion | null> {
  const e = await estudiantes.activoDePersona(personaId);
  return e ? { estudianteId: e.id, nombres: e.persona.nombres, apellidos: e.persona.apellidos } : null;
}
