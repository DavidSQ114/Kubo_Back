// horarios/application: aviso por correo al alumno y a su apoderado principal cuando las inasistencias injustificadas
// alcanzan un umbral de la institución (US52, criterios 2 y 3; RF54). Cada umbral se avisa una sola vez por periodo:
// antes de enviar se deja constancia en aviso_asistencia y, en esa misma transacción, los avisos del 15 % y del 20 %
// notifican al apoderado principal dentro de la aplicación (US55). Los correos salen después de confirmar; si fallan,
// quedan en la bandeja de salida.
import { prisma } from "@/platform/db/prisma";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { logger } from "@/platform/logger";
import { despacharCorreos, registrarAvisos, type AvisoInterno, type CorreoSaliente } from "@/platform/notificaciones";
import { contactosDeAsistencia, type ContactoDeAsistencia } from "@/modules/comunidad";
import { usuariosDePersonas } from "@/modules/identidad";
import { datosDeMatriculas } from "@/modules/matricula";
import {
  avisosAlcanzados,
  avisosConCorreo,
  avisosPendientes,
  baseDeInasistencia,
  cantidad,
  diasDeAsistencia,
  mesDe,
  nombreDelMes,
  porcentajeDeInasistencia,
  type Aviso,
  type BaseDeInasistencia,
  type Umbrales,
} from "../domain/asistencia";
import { asistencias, avisos } from "../infrastructure/asistencia";
import { anioDeAsistencia, leerUmbrales, type AnioDeAsistencia } from "./asistenciaPortales";

export interface AvisosEnviados {
  /** Umbrales alcanzados por primera vez con este registro. */
  avisos: number;
  /** Correos enviados (un destinatario sin correo o un fallo del servidor de correo no revierten el registro). */
  correos: number;
}

const PIE = "Este es un mensaje automático: no lo respondas.";

/** «18,3 %»: el porcentaje con coma decimal, como se escribe en español. */
const enPorcentaje = (valor: number) => `${String(valor).replace(".", ",")} %`;

/** Texto del aviso para el alumno (`sujeto` «Registras») o para su apoderado («Diego registra»). */
function textoDelAviso(
  aviso: Aviso,
  datos: { sujeto: string; lectivos: number; desdeMatricula: boolean; umbrales: Umbrales },
): { asunto: string; cuerpo: string } {
  const inasistencias = cantidad(aviso.faltas, "inasistencia injustificada", "inasistencias injustificadas");
  if (aviso.tipo === "FALTAS_MES") {
    return {
      asunto: `Kubo · ${inasistencias} en ${nombreDelMes(aviso.periodo)}`,
      cuerpo:
        `${datos.sujeto} ${inasistencias} en ${nombreDelMes(aviso.periodo)}. ` +
        `Si hay una constancia que ${aviso.faltas === 1 ? "la justifique" : "las justifique"}, preséntala al tutor ` +
        "de la sección.",
    };
  }
  const base = `${cantidad(datos.lectivos, "día de clase", "días de clase")}${datos.desdeMatricula ? " desde la matrícula" : ""}`;
  const porcentaje = enPorcentaje(porcentajeDeInasistencia(aviso.faltas, datos.lectivos));
  const limite = enPorcentaje(Math.round(datos.umbrales.riesgo * 1000) / 10);
  if (aviso.tipo === "PORCENTAJE_RIESGO") {
    return {
      asunto: "Kubo · Riesgo por inasistencias",
      cuerpo:
        `${datos.sujeto} ${inasistencias} en el año escolar ${aviso.periodo} ` +
        `(${porcentaje} de ${base}): se alcanzó el límite institucional de ${limite}. ` +
        "Conversa con el tutor de la sección para evitar consecuencias académicas.",
    };
  }
  return {
    asunto: "Kubo · Aviso por inasistencias",
    cuerpo:
      `${datos.sujeto} ${inasistencias} en el año escolar ${aviso.periodo} ` +
      `(${porcentaje} de ${base}). El límite institucional es ${limite}: ` +
      "conviene evitar nuevas inasistencias.",
  };
}

interface DatosDelAviso {
  base: BaseDeInasistencia;
  umbrales: Umbrales;
}

/** Correos del aviso al alumno y a su apoderado principal (los que tienen correo). */
function correosDelAviso(aviso: Aviso, contacto: ContactoDeAsistencia, d: DatosDelAviso): CorreoSaliente[] {
  const nombre = contacto.nombres.split(" ")[0];
  const destinatarios: { para: string; saludo: string; sujeto: string }[] = [];
  if (contacto.email) destinatarios.push({ para: contacto.email, saludo: nombre, sujeto: "Registras" });
  if (contacto.apoderadoPrincipal?.email) {
    destinatarios.push({
      para: contacto.apoderadoPrincipal.email,
      saludo: contacto.apoderadoPrincipal.nombres.split(" ")[0],
      sujeto: `${nombre} registra`,
    });
  }
  return destinatarios.map((x) => {
    const { asunto, cuerpo } = textoDelAviso(aviso, {
      sujeto: x.sujeto,
      lectivos: d.base.lectivos,
      desdeMatricula: d.base.desdeMatricula,
      umbrales: d.umbrales,
    });
    return {
      para: x.para,
      asunto,
      texto: `Hola, ${x.saludo}:\n\n${cuerpo} Ingresa a Kubo para ver el detalle de la asistencia.\n\n${PIE}`,
    };
  });
}

/** Notificación del 15 % o del 20 % para el apoderado principal con cuenta (US55); el aviso mensual va solo por correo. */
function notificacionDelAviso(
  aviso: Aviso,
  contacto: ContactoDeAsistencia,
  usuarioId: string | null,
  d: DatosDelAviso,
): AvisoInterno[] {
  if (!usuarioId || aviso.tipo === "FALTAS_MES") return [];
  const { asunto, cuerpo } = textoDelAviso(aviso, {
    sujeto: `${contacto.nombres.split(" ")[0]} registra`,
    lectivos: d.base.lectivos,
    desdeMatricula: d.base.desdeMatricula,
    umbrales: d.umbrales,
  });
  return [
    {
      usuarioId,
      tipo: "ASISTENCIA",
      titulo: asunto.replace(/^Kubo · /, ""),
      mensaje: cuerpo,
      enlace: "/apoderado/asistencia",
    },
  ];
}

/** Cuenta del apoderado principal, para la notificación interna; null si no tiene. */
async function usuarioDelApoderado(contacto: ContactoDeAsistencia | undefined): Promise<string | null> {
  const personaId = contacto?.apoderadoPrincipal?.personaId;
  if (!personaId) return null;
  return (await usuariosDePersonas([personaId]))[personaId] ?? null;
}

async function avisarMatricula(
  m: { matriculaId: string; estudianteId: string; fechaMatricula: string },
  anio: AnioDeAsistencia,
  umbrales: Umbrales,
  fecha: string,
): Promise<AvisosEnviados> {
  const registros = await asistencias.deMatricula(m.matriculaId, anio);
  const ausencias = diasDeAsistencia(registros).filter((d) => d.estado === "AUSENTE");
  // la base son los días de clase que le corresponden desde su matrícula, no los de todo el año (D-11)
  const base = baseDeInasistencia(anio.bimestres, m.fechaMatricula);
  const alcanzados = avisosAlcanzados(
    {
      anio: anio.anio,
      mes: mesDe(fecha),
      faltasDelMes: ausencias.filter((d) => mesDe(d.fecha) === mesDe(fecha)).length,
      faltasDelAnio: ausencias.length,
      lectivos: base.lectivos,
    },
    umbrales,
  );
  const pendientes = avisosPendientes(alcanzados, await avisos.deMatricula(m.matriculaId));
  if (!pendientes.length) return { avisos: 0, correos: 0 };
  const contacto = (await contactosDeAsistencia([m.estudianteId]))[m.estudianteId];
  const usuarioApoderado = await usuarioDelApoderado(contacto);
  const datos = { base, umbrales };
  // se deja constancia primero: si otro registro llega a la vez, la clave única deja pasar solo a uno; la
  // notificación y los correos quedan registrados en la misma transacción que la constancia
  const { nuevos, correosPorAviso } = await prisma.$transaction(async (tx) => {
    const creados: (Aviso & { id: string })[] = [];
    for (const aviso of pendientes) {
      const id = await avisos.registrar(
        m.matriculaId,
        { tipo: aviso.tipo, periodo: aviso.periodo, faltas: aviso.faltas },
        tx,
      );
      if (id) creados.push({ ...aviso, id });
    }
    const porAviso = new Map<string, string[]>();
    for (const aviso of avisosConCorreo(creados)) {
      const ids = await registrarAvisos(tx, {
        notificaciones: contacto ? notificacionDelAviso(aviso, contacto, usuarioApoderado, datos) : [],
        correos: contacto ? correosDelAviso(aviso, contacto, datos) : [],
        origen: { entidad: "aviso_asistencia", id: aviso.id },
      });
      porAviso.set(aviso.id, ids);
    }
    return { nuevos: creados, correosPorAviso: porAviso };
  });
  let correos = 0;
  for (const [avisoId, ids] of correosPorAviso) {
    const enviados = await despacharCorreos(ids);
    await avisos.marcarCorreos(avisoId, enviados);
    correos += enviados;
  }
  return { avisos: nuevos.length, correos };
}

/**
 * Revisa los umbrales de los alumnos a los que se acaba de registrar una falta en `fecha` y avisa por correo los que
 * se alcanzan por primera vez. Nunca lanza: la asistencia ya está guardada y el aviso no debe revertirla ni
 * bloquearla.
 */
export async function avisarPorInasistencias(
  matriculaIds: string[],
  fecha: string,
  meta: MetaSolicitud,
): Promise<AvisosEnviados> {
  const total: AvisosEnviados = { avisos: 0, correos: 0 };
  if (!matriculaIds.length) return total;
  try {
    const matriculas = Object.values(await datosDeMatriculas(matriculaIds));
    const anios = new Map<string, { anio: AnioDeAsistencia; umbrales: Umbrales }>();
    for (const m of matriculas) {
      if (!anios.has(m.anioAcademicoId)) {
        anios.set(m.anioAcademicoId, {
          anio: await anioDeAsistencia(m.anioAcademicoId),
          umbrales: await leerUmbrales(m.anioAcademicoId),
        });
      }
      const { anio, umbrales } = anios.get(m.anioAcademicoId)!;
      const r = await avisarMatricula(m, anio, umbrales, fecha);
      total.avisos += r.avisos;
      total.correos += r.correos;
    }
  } catch (e) {
    logger.warn("No se pudieron enviar los avisos por inasistencias", {
      requestId: meta.requestId,
      error: (e as Error).message,
    });
  }
  return total;
}
