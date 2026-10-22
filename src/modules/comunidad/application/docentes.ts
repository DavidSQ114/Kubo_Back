// comunidad/application: registro de docentes (US13, RF11, AD-07) y docentes para elegir tutor o asignar cursos.
import { prisma } from "@/platform/db/prisma";
import { esDuplicado } from "@/platform/db/tipos";
import { registrarAuditoria } from "@/platform/auditoria";
import { ErrorApp } from "@/platform/http/errores";
import type { MetaSolicitud } from "@/platform/http/ruta";
import type { DocenteResumen } from "@/modules/academico";
import { asegurarCuenta, enviarBienvenida, type Autenticado } from "@/modules/identidad";
import { accionPerfilDocente, normalizarTelefono } from "../domain/docentes";
import { docentes, personas } from "../infrastructure/repositorio";

type FilaDocente = Awaited<ReturnType<typeof docentes.activos>>[number];

/** «Mónica Torres Aguilar» → nombreCorto «M. Torres» (inicial y primer apellido). */
export function resumenDocente(d: FilaDocente): DocenteResumen {
  const { nombres, apellidos } = d.persona;
  return {
    id: d.id,
    nombreCompleto: `${nombres} ${apellidos}`,
    nombreCorto: `${nombres.charAt(0)}. ${apellidos.split(" ")[0]}`,
    activo: d.activo && d.persona.activo,
  };
}

export async function listarDocentesActivos(): Promise<DocenteResumen[]> {
  return (await docentes.activos()).map(resumenDocente);
}

export interface DatosDocente {
  dni: string;
  nombres: string;
  apellidos: string;
  email: string;
  especialidad: string;
  telefono?: string | null;
  fechaNacimiento?: string | null;
  /** Correo de bienvenida con la contraseña temporal (por defecto, sí). */
  enviarCorreo?: boolean;
}

/**
 * Registra un Docente (US13). Si el DNI es de una persona nueva, crea persona, perfil y cuenta con contraseña
 * temporal (debe cambiarla al ingresar, US54). Si la persona ya existe con otro perfil, solo le agrega el perfil
 * Docente: no cambia sus datos ni crea otra cuenta. Todo en una transacción; el correo va después.
 */
export async function registrarDocente(admin: Autenticado, datos: DatosDocente, urlBase: string, meta: MetaSolicitud) {
  let resultado;
  try {
    resultado = await prisma.$transaction(async (tx) => {
      const existente = await personas.porDni(datos.dni, tx);
      const persona =
        existente ??
        (await personas.crear(
          {
            dni: datos.dni,
            nombres: datos.nombres,
            apellidos: datos.apellidos,
            email: datos.email,
            telefono: datos.telefono ? normalizarTelefono(datos.telefono) : null,
            fechaNacimiento: datos.fechaNacimiento ? new Date(`${datos.fechaNacimiento}T00:00:00.000Z`) : null,
          },
          tx,
        ));

      const perfil = existente ? await personas.docenteDe(persona.id, tx) : null;
      const accion = accionPerfilDocente(perfil);
      const docente =
        accion === "REACTIVAR"
          ? await personas.reactivarDocente(perfil!.id, datos.especialidad, tx)
          : await personas.crearDocente({ personaId: persona.id, especialidad: datos.especialidad }, tx);

      const cuenta = await asegurarCuenta(tx, { personaId: persona.id, email: datos.email });

      await registrarAuditoria(
        tx,
        {
          usuarioId: admin.usuarioId,
          entidad: "docente",
          entidadId: docente.id,
          accion: accion === "REACTIVAR" ? "REACTIVAR_PERFIL_DOCENTE" : "REGISTRAR_DOCENTE",
          nuevo: {
            personaId: persona.id,
            especialidad: datos.especialidad,
            personaExistia: Boolean(existente),
            cuentaCreada: cuenta.creada,
          },
        },
        meta,
      );
      return { persona, docenteId: docente.id, personaExistia: Boolean(existente), cuenta };
    });
  } catch (e) {
    if (esDuplicado(e, "email")) {
      throw new ErrorApp("EMAIL_EN_USO", "Ese correo ya está registrado en otra cuenta.", 409);
    }
    throw e;
  }

  const { persona, docenteId, personaExistia, cuenta } = resultado;
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
    personaId: persona.id,
    docenteId,
    usuarioId: cuenta.usuarioId,
    nombreCompleto: `${persona.nombres} ${persona.apellidos}`,
    email: cuenta.email,
    especialidad: datos.especialidad,
    // «Se agregó el perfil Docente a una persona ya registrada»: la pantalla lo avisa con este dato.
    personaExistia,
    cuentaCreada: cuenta.creada,
    correoEnviado,
    // Se muestra una sola vez al administrador por si el correo no llega. No se guarda en ningún lugar.
    passwordTemporal: cuenta.passwordTemporal,
  };
}
