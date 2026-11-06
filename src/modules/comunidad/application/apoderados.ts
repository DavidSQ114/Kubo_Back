// comunidad/application: registro y búsqueda de apoderados (US15, RF12, AD-08).
import { prisma } from "@/platform/db/prisma";
import { esDuplicado } from "@/platform/db/tipos";
import { registrarAuditoria } from "@/platform/auditoria";
import { ErrorApp } from "@/platform/http/errores";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { asegurarCuenta, enviarBienvenida, type Autenticado } from "@/modules/identidad";
import { erroresComunidad as E } from "../domain/errores";
import {
  accionPerfil,
  datosFaltantes,
  fechaSinHora,
  verificarEstudiantesSinRepetir,
  type Parentesco,
} from "../domain/vinculos";
import { apoderados, personas, type Pagina } from "../infrastructure/repositorio";
import { personaParaPerfil } from "./personas";
import { vincularEnTx } from "./vinculos";

export interface ApoderadoListado {
  apoderadoId: string;
  personaId: string;
  dni: string;
  nombreCompleto: string;
  telefono: string | null;
  email: string | null;
  ocupacion: string | null;
  /** Estudiantes vinculados. */
  estudiantes: number;
}

type FilaApoderado = Awaited<ReturnType<typeof apoderados.buscar>>["filas"][number];

export const vistaApoderado = (a: FilaApoderado): ApoderadoListado => ({
  apoderadoId: a.id,
  personaId: a.persona.id,
  dni: a.persona.dni,
  nombreCompleto: `${a.persona.nombres} ${a.persona.apellidos}`,
  telefono: a.persona.telefono,
  email: a.persona.email,
  ocupacion: a.ocupacion,
  estudiantes: a._count.vinculosApoderado,
});

/** Apoderados activos por DNI o nombre, paginados (AD-08 y para elegir apoderado en AD-09). */
export async function buscarApoderados(f: Pagina) {
  const { total, filas } = await apoderados.buscar(f);
  return {
    items: filas.map(vistaApoderado),
    paginacion: { pagina: f.pagina, tamano: f.tamano, total, paginas: Math.ceil(total / f.tamano) },
  };
}

export interface DatosApoderado {
  dni: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  email: string;
  telefono: string;
  direccion: string;
  ocupacion: string;
  /** Estudiantes ya registrados que se vinculan en el mismo guardado. */
  vinculos: { estudianteId: string; parentesco: Parentesco; esPrincipal: boolean; autorizado: boolean }[];
  /** Correo de bienvenida con la contraseña temporal (por defecto, sí). */
  enviarCorreo?: boolean;
}

/**
 * Registra un Apoderado (US15) con su cuenta (rol Apoderado, contraseña temporal) y, si se indican, sus vínculos
 * con estudiantes ya registrados. Si el DNI es de una persona con otro perfil, solo se le agrega el perfil
 * Apoderado: se completan los datos que le faltaban, sin reemplazar los registrados (D-07). Si ya es apoderado:
 * 409 APODERADO_EXISTENTE con su id para que la pantalla ofrezca vincularlo a un estudiante. Todo en una
 * transacción; el correo va después.
 */
export async function registrarApoderado(
  admin: Autenticado,
  datos: DatosApoderado,
  urlBase: string,
  meta: MetaSolicitud,
) {
  verificarEstudiantesSinRepetir(datos.vinculos.map((v) => v.estudianteId));
  let resultado;
  try {
    resultado = await prisma.$transaction(async (tx) => {
      const existente = await personaParaPerfil(tx, datos);
      const perfil = existente ? await apoderados.dePersona(existente.id, tx) : null;
      const accion = accionPerfil(perfil, () =>
        E.apoderadoExistente({
          apoderadoId: perfil!.id,
          nombreCompleto: `${existente!.nombres} ${existente!.apellidos}`,
          estudiantes: perfil!._count.vinculosApoderado,
        }),
      );

      const contacto = {
        email: datos.email,
        telefono: datos.telefono,
        direccion: datos.direccion,
        fechaNacimiento: fechaSinHora(datos.fechaNacimiento),
      };
      let personaId: string;
      if (existente) {
        const faltantes = datosFaltantes(existente, contacto);
        if (Object.keys(faltantes).length) await personas.completar(existente.id, faltantes, tx);
        personaId = existente.id;
      } else {
        const { dni, nombres, apellidos } = datos;
        personaId = (await personas.crear({ dni, nombres, apellidos, ...contacto }, tx)).id;
      }
      // Los nombres registrados mandan: los enviados ya se compararon con ellos (D-07).
      const persona = {
        id: personaId,
        nombres: existente?.nombres ?? datos.nombres,
        apellidos: existente?.apellidos ?? datos.apellidos,
      };

      const apoderado =
        accion === "REACTIVAR"
          ? await apoderados.reactivar(perfil!.id, datos.ocupacion, tx)
          : await apoderados.crear({ personaId: persona.id, ocupacion: datos.ocupacion }, tx);

      const cuenta = await asegurarCuenta(tx, { personaId: persona.id, email: datos.email });

      await registrarAuditoria(
        tx,
        {
          usuarioId: admin.usuarioId,
          entidad: "apoderado",
          entidadId: apoderado.id,
          accion: "REGISTRAR_APODERADO",
          nuevo: {
            personaId: persona.id,
            ocupacion: datos.ocupacion,
            personaExistia: Boolean(existente),
            perfilReactivado: accion === "REACTIVAR",
            cuentaCreada: cuenta.creada,
          },
        },
        meta,
      );

      const vinculados = [];
      for (const v of datos.vinculos) {
        vinculados.push(await vincularEnTx(tx, admin, { ...v, apoderadoId: apoderado.id }, meta));
      }
      return { persona, apoderadoId: apoderado.id, personaExistia: Boolean(existente), cuenta, vinculados };
    });
  } catch (e) {
    if (esDuplicado(e, "email")) {
      throw new ErrorApp("EMAIL_EN_USO", "Ese correo ya está registrado en otra cuenta.", 409);
    }
    if (esDuplicado(e, "dni")) throw E.dniEnUso();
    throw e;
  }

  const { persona, apoderadoId, personaExistia, cuenta, vinculados } = resultado;
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
    apoderadoId,
    usuarioId: cuenta.usuarioId,
    nombreCompleto: `${persona.nombres} ${persona.apellidos}`,
    email: cuenta.email,
    personaExistia,
    cuentaCreada: cuenta.creada,
    correoEnviado,
    estudiantesVinculados: vinculados.length,
    // Se muestra una sola vez al administrador por si el correo no llega. No se guarda en ningún lugar.
    passwordTemporal: cuenta.passwordTemporal,
  };
}
