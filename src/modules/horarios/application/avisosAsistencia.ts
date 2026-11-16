// horarios/application: aviso por correo al alumno y a su apoderado principal cuando las inasistencias injustificadas
// alcanzan un umbral de la institución (US52, criterios 2 y 3; RF54). Cada umbral se avisa una sola vez por periodo:
// antes de enviar se deja constancia en aviso_asistencia. La notificación dentro de la aplicación llega con US55.
import { enviarCorreo } from "@/platform/correo";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { logger } from "@/platform/logger";
import { contactosDeAsistencia, type ContactoDeAsistencia } from "@/modules/comunidad";
import { datosDeMatriculas } from "@/modules/matricula";
import {
  avisosAlcanzados,
  avisosConCorreo,
  avisosPendientes,
  diasDeAsistencia,
  diasLectivos,
  mesDe,
  nombreDelMes,
  porcentajeDeInasistencia,
  type Aviso,
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
  datos: { sujeto: string; lectivos: number; umbrales: Umbrales },
): { asunto: string; cuerpo: string } {
  if (aviso.tipo === "FALTAS_MES") {
    return {
      asunto: `Kubo · ${aviso.faltas} inasistencias injustificadas en ${nombreDelMes(aviso.periodo)}`,
      cuerpo:
        `${datos.sujeto} ${aviso.faltas} inasistencias injustificadas en ${nombreDelMes(aviso.periodo)}. ` +
        "Si hay una constancia que las justifique, preséntala al tutor de la sección.",
    };
  }
  const porcentaje = enPorcentaje(porcentajeDeInasistencia(aviso.faltas, datos.lectivos));
  const limite = enPorcentaje(Math.round(datos.umbrales.riesgo * 1000) / 10);
  if (aviso.tipo === "PORCENTAJE_RIESGO") {
    return {
      asunto: "Kubo · Riesgo por inasistencias",
      cuerpo:
        `${datos.sujeto} ${aviso.faltas} inasistencias injustificadas en el año escolar ${aviso.periodo} ` +
        `(${porcentaje} de los días de clase): se alcanzó el límite institucional de ${limite}. ` +
        "Conversa con el tutor de la sección para evitar consecuencias académicas.",
    };
  }
  return {
    asunto: "Kubo · Aviso por inasistencias",
    cuerpo:
      `${datos.sujeto} ${aviso.faltas} inasistencias injustificadas en el año escolar ${aviso.periodo} ` +
      `(${porcentaje} de los días de clase). El límite institucional es ${limite}: ` +
      "conviene evitar nuevas inasistencias.",
  };
}

/** Envía el aviso al alumno y a su apoderado principal. Devuelve cuántos correos salieron. */
async function enviarAviso(aviso: Aviso, contacto: ContactoDeAsistencia, lectivos: number, umbrales: Umbrales) {
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
  // allSettled: un correo que falla no impide enviar el otro
  const resultados = await Promise.allSettled(
    destinatarios.map((d) => {
      const { asunto, cuerpo } = textoDelAviso(aviso, { sujeto: d.sujeto, lectivos, umbrales });
      return enviarCorreo({
        para: d.para,
        asunto,
        texto: `Hola, ${d.saludo}:\n\n${cuerpo} Ingresa a Kubo para ver el detalle de la asistencia.\n\n${PIE}`,
      });
    }),
  );
  return resultados.filter((r) => r.status === "fulfilled" && r.value).length;
}

async function avisarMatricula(
  m: { matriculaId: string; estudianteId: string },
  anio: AnioDeAsistencia,
  umbrales: Umbrales,
  fecha: string,
): Promise<AvisosEnviados> {
  const registros = await asistencias.deMatricula(m.matriculaId, anio);
  const ausencias = diasDeAsistencia(registros).filter((d) => d.estado === "AUSENTE");
  const lectivos = diasLectivos(anio.bimestres);
  const alcanzados = avisosAlcanzados(
    {
      anio: anio.anio,
      mes: mesDe(fecha),
      faltasDelMes: ausencias.filter((d) => mesDe(d.fecha) === mesDe(fecha)).length,
      faltasDelAnio: ausencias.length,
      lectivos,
    },
    umbrales,
  );
  const pendientes = avisosPendientes(alcanzados, await avisos.deMatricula(m.matriculaId));
  // se deja constancia primero: si otro registro llega a la vez, la clave única deja pasar solo a uno
  const nuevos: (Aviso & { id: string })[] = [];
  for (const aviso of pendientes) {
    const id = await avisos.registrar(m.matriculaId, {
      tipo: aviso.tipo,
      periodo: aviso.periodo,
      faltas: aviso.faltas,
    });
    if (id) nuevos.push({ ...aviso, id });
  }
  if (!nuevos.length) return { avisos: 0, correos: 0 };
  const contacto = (await contactosDeAsistencia([m.estudianteId]))[m.estudianteId];
  let correos = 0;
  for (const aviso of avisosConCorreo(nuevos)) {
    const enviados = contacto ? await enviarAviso(aviso, contacto, lectivos, umbrales) : 0;
    await avisos.marcarCorreos(aviso.id, enviados);
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
