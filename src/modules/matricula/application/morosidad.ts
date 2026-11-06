// matricula/application: panel de morosidad (US24, AD-12). Estudiantes con cuotas Pendiente vencidas al día de hoy
// en Lima, con meses adeudados, deuda total, días de atraso y el apoderado responsable con su teléfono. Una consulta
// agregada para las deudas y una por cada dato complementario (secciones, estudiantes, responsables): sin N+1.
import { aCentimos, deCentimos, fechaEnLima, listarSecciones, obtenerAnio } from "@/modules/academico";
import { resumenEstudiantes, responsablesDeVinculos } from "@/modules/comunidad";
import {
  conMinimoDeMeses,
  diasAtraso,
  etiquetasAdeudadas,
  mesesAdeudados,
  ordenarMorosidad,
  type OrdenMorosidad,
} from "../domain/morosidad";
import { deudasVencidas } from "../infrastructure/morosidad";

export interface FiltroMorosidad {
  anioId: string;
  gradoId?: string;
  seccionId?: string;
  /** Mínimo de cuotas vencidas («Meses adeudados»: 1, 2, 3 o más). */
  mesesMinimos?: number;
  orden: OrdenMorosidad;
}

/** Panel de morosidad del año, con los filtros de grado, sección y meses, ordenado por monto o por meses. */
export async function panelMorosidad(f: FiltroMorosidad) {
  const hoy = fechaEnLima(new Date());
  const [anio, secciones] = await Promise.all([obtenerAnio(f.anioId), listarSecciones(f.anioId)]);
  const seccionIds = f.seccionId
    ? [f.seccionId]
    : f.gradoId
      ? secciones.filter((s) => s.grado.id === f.gradoId).map((s) => s.id)
      : null;
  const deudas = await deudasVencidas({ anioId: f.anioId, hoy, seccionIds });
  const [estudiantes, responsables] = await Promise.all([
    resumenEstudiantes(deudas.map((d) => d.estudianteId)),
    responsablesDeVinculos(deudas.flatMap((d) => (d.vinculoId ? [d.vinculoId] : []))),
  ]);
  const seccionPorId = new Map(secciones.map((s) => [s.id, s]));

  const filas = deudas.map((d) => {
    const cuotas = d.tipos.map((tipo, i) => ({ tipo, mes: d.meses[i] }));
    const seccion = d.seccionId ? seccionPorId.get(d.seccionId) : undefined;
    const responsable = d.vinculoId ? responsables[d.vinculoId] : undefined;
    return {
      matriculaId: d.matriculaId,
      estudianteId: d.estudianteId,
      nombreCompleto: estudiantes[d.estudianteId]?.nombreCompleto ?? "—",
      seccion: seccion ? { id: seccion.id, nombre: `${seccion.grado.numero}° ${seccion.nombre}` } : null,
      adeudado: etiquetasAdeudadas(cuotas),
      mesesAdeudados: mesesAdeudados(cuotas),
      cuotasVencidas: d.cuotasVencidas,
      deuda: deCentimos(aCentimos(d.deuda)),
      deudaCentimos: aCentimos(d.deuda),
      primerVencimiento: d.primerVencimiento,
      diasAtraso: diasAtraso(d.primerVencimiento, hoy),
      responsable: responsable
        ? {
            nombreCompleto: responsable.nombreCompleto,
            parentesco: responsable.parentesco,
            telefono: responsable.telefono,
          }
        : null,
    };
  });
  const lista = ordenarMorosidad(conMinimoDeMeses(filas, f.mesesMinimos), f.orden);
  const total = lista.reduce((t, x) => t + x.deudaCentimos, 0);
  return {
    fecha: hoy,
    anio: { id: anio.id, anio: anio.anio },
    resumen: {
      estudiantes: lista.length,
      deudaTotal: deCentimos(total),
      cuotasVencidas: lista.reduce((t, x) => t + x.cuotasVencidas, 0),
    },
    // deudaCentimos solo sirve para ordenar y sumar; la API entrega el monto como texto
    items: lista.map((x) => ({ ...x, deudaCentimos: undefined })),
  };
}
