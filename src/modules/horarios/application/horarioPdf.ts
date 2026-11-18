// horarios/application: «Descargar PDF» del horario en el portal del apoderado (US66, criterio 2; AP-05). Genera la
// versión PUBLICADA vigente de la sección del hijo con el mismo generador de PDF de los recibos (US25). El hijo se
// verifica por su vínculo con el apoderado (403 si no es su hijo).
import { generarPdf } from "@/platform/pdf";
import type { Autenticado } from "@/modules/identidad";
import { erroresHorarios as E } from "../domain/errores";
import { DIAS, NOMBRE_DIA } from "../domain/tipos";
import { horarioDelHijo, type HorarioDeEstudiante } from "./portales";

/** Ancho de la columna de horas; el resto se reparte entre los cinco días. */
const ANCHO_HORA = 0.15;

const soloLetras = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "");

/** Filas del horario: un bloque por fila y, en cada día, «Curso · Aula · Docente» (el recreo ocupa toda la fila). */
export function filasDelHorario(h: Pick<HorarioDeEstudiante, "bloques" | "clases">): string[][] {
  return [...h.bloques]
    .sort((a, b) => a.orden - b.orden)
    .map((b) => {
      const hora = `${b.horaInicio} – ${b.horaFin}`;
      if (b.tipo !== "CLASE") return [hora, b.etiqueta, ...DIAS.slice(1).map(() => "")];
      return [
        hora,
        ...DIAS.map((dia) => {
          const c = h.clases.find((x) => x.dia === dia && x.bloqueId === b.id);
          return c ? `${c.curso.nombre} · ${c.aula.nombre} · ${c.docente.nombreCorto}` : "—";
        }),
      ];
    });
}

/** PDF del horario publicado del hijo (US66). Sin horario publicado: 422 HORARIO_NO_PUBLICADO, sin archivo. */
export async function horarioPdfDelHijo(auth: Autenticado, estudianteId: string) {
  const h = await horarioDelHijo(auth, estudianteId);
  if (!h.horario || !h.seccion) throw E.horarioNoPublicado();
  const anchoDia = (1 - ANCHO_HORA) / DIAS.length;
  const bytes = await generarPdf({
    nombre: "horario-del-estudiante",
    institucion: "Kubo · Institución educativa",
    titulo: "Horario de clases",
    subtitulo: `${h.estudiante.nombreCompleto} · ${h.seccion.grado.nombre} ${h.seccion.nombre} · Año ${h.seccion.anio.anio}`,
    bloques: [
      {
        tipo: "tabla",
        titulo: `Versión ${h.horario.version} publicada`,
        columnas: [
          { titulo: "Hora", ancho: ANCHO_HORA },
          ...DIAS.map((d) => ({ titulo: NOMBRE_DIA[d], ancho: anchoDia })),
        ],
        filas: filasDelHorario(h),
        vacio: "La sección no tiene bloques de clase.",
      },
      { tipo: "texto", texto: "Cada clase indica el curso, el aula y el docente." },
    ],
    pie: "Horario vigente al momento de la descarga",
  });
  const nombre = `${h.estudiante.nombres.trim().split(" ")[0]}`;
  return { bytes, nombreArchivo: `Horario_${h.seccion.anio.anio}_${soloLetras(nombre)}.pdf` };
}
