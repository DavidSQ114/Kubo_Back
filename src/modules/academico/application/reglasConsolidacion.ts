// academico/application: reglas de consolidación por año académico (US12, RF10, pantalla AD-05).
// Cada guardado crea una versión nueva (version + 1) que rige desde un bimestre; las anteriores quedan como
// historial de solo lectura. El cálculo en sí es la función pura consolidarLogro (domain/consolidacion).
import { prisma } from "@/platform/db/prisma";
import { registrarAuditoria } from "@/platform/auditoria";
import { errores } from "@/platform/http/errores";
import type { MetaSolicitud } from "@/platform/http/ruta";
import type { Autenticado } from "@/modules/identidad";
import {
  bimestresDeVersion,
  configuracionDeRegla,
  consolidarLogro,
  frecuencias,
  logrosMasFrecuentes,
  NOMBRE_METODO,
  promedioPonderado,
  textoAlcance,
  verificarRigeDesde,
  type CriterioDesempate,
  type Logro,
  type MetodoConsolidacion,
  type PeriodoParaRegla,
} from "../domain/consolidacion";
import { erroresAcademico as E } from "../domain/errores";
import { anios, periodos, reglas, type ReglaFila } from "../infrastructure/repositorio";
import { cierresProvider, personasProvider } from "../puertos";

export interface VersionRegla {
  id: string;
  version: number;
  nombre: string;
  metodo: MetodoConsolidacion;
  criterioDesempate: CriterioDesempate;
  estado: "VIGENTE" | "ARCHIVADA" | "BORRADOR";
  rigeDesde: { id: string; numero: number; nombre: string } | null;
  /** «Desde Bimestre III», «Bimestres I y II»… */
  aplicadaA: string;
  responsable: string | null;
  creadaEn: string;
}

export interface ReglasDelAnio {
  anio: { id: string; anio: number; estado: string };
  /** false si el año está CERRADO: las reglas solo se consultan. */
  editable: boolean;
  vigente: VersionRegla | null;
  /** Todas las versiones, de la más nueva a la más antigua (incluida la vigente). */
  historial: VersionRegla[];
  /** Bimestres del año; los cerrados (FINALIZADO o con cierres) no se pueden elegir como «rige desde». */
  periodos: (PeriodoParaRegla & { nombre: string; estado: string })[];
}

/** Quién guardó la versión: se guarda en la configuración para poder mostrarlo en el historial. */
const responsableDe = (r: ReglaFila) => (r.configuracion as { registradaPor?: string } | null)?.registradaPor ?? null;

async function vistaVersiones(filas: ReglaFila[]): Promise<VersionRegla[]> {
  const ids = [...new Set(filas.map(responsableDe).filter((id): id is string => Boolean(id)))];
  const nombres = ids.length ? await personasProvider().nombresCortos(ids) : {};
  const conNumero = filas.map((f) => ({ version: f.version, rigeDesdeNumero: f.rigeDesde?.numero ?? null }));
  return filas.map((f) => ({
    id: f.id,
    version: f.version,
    nombre: f.nombre,
    metodo: f.metodo,
    criterioDesempate: f.criterioDesempate,
    estado: f.estado,
    rigeDesde: f.rigeDesde,
    aplicadaA: textoAlcance(bimestresDeVersion(conNumero, f.version)),
    responsable: nombres[responsableDe(f) ?? ""] ?? null,
    creadaEn: f.creadaEn,
  }));
}

/** Bimestres del año marcando los cerrados: FINALIZADO o con algún cierre de calificación cerrado o publicado. */
async function periodosParaRegla(anioId: string) {
  const [lista, conCierres] = await Promise.all([
    periodos.delAnio(anioId),
    cierresProvider().periodosConCierres(anioId),
  ]);
  return lista.map((p) => ({
    id: p.id,
    numero: p.numero,
    nombre: p.nombre,
    estado: p.estado,
    cerrado: p.estado === "FINALIZADO" || conCierres.includes(p.id),
  }));
}

/** Regla vigente del año, su historial y los bimestres desde los que puede regir una nueva versión. */
export async function reglasDelAnio(anioId: string): Promise<ReglasDelAnio> {
  const anio = await anios.porId(anioId);
  if (!anio) throw errores.noEncontrado("El año académico");
  const [historial, lista] = await Promise.all([
    reglas.delAnio(anioId).then(vistaVersiones),
    periodosParaRegla(anioId),
  ]);
  return {
    anio: { id: anio.id, anio: anio.anio, estado: anio.estado },
    editable: anio.estado !== "CERRADO",
    vigente: historial.find((v) => v.estado === "VIGENTE") ?? null,
    historial,
    periodos: lista,
  };
}

export interface DatosRegla {
  metodo: MetodoConsolidacion;
  criterioDesempate?: CriterioDesempate;
  rigeDesdeId?: string | null;
}

/**
 * Guarda una nueva versión de la regla del año: archiva la vigente y crea version + 1 (VIGENTE) que rige desde el
 * bimestre elegido. Los bimestres ya cerrados conservan la versión con que se calcularon.
 */
export async function guardarRegla(admin: Autenticado, anioId: string, datos: DatosRegla, meta: MetaSolicitud) {
  // el criterio de desempate solo aplica a la moda; en el ponderado se guarda el valor por defecto
  const criterio: CriterioDesempate =
    datos.metodo === "MODA" ? (datos.criterioDesempate ?? "MAYOR_JERARQUIA") : "MAYOR_JERARQUIA";
  const lista = await periodosParaRegla(anioId);

  await prisma.$transaction(async (tx) => {
    await anios.bloquearFila(tx, anioId);
    const anio = await anios.porId(anioId, tx);
    if (!anio) throw errores.noEncontrado("El año académico");
    if (anio.estado === "CERRADO") throw E.anioCerrado();
    const rigeDesdeId = verificarRigeDesde(lista, datos.rigeDesdeId);

    const versiones = await reglas.delAnio(anioId, tx);
    const vigente = versiones.find((v) => v.estado === "VIGENTE") ?? null;
    if (vigente && vigente.metodo === datos.metodo && vigente.criterioDesempate === criterio) {
      throw E.reglaSinCambios();
    }

    await reglas.archivarVigente(anioId, tx);
    const nueva = await reglas.crear(
      {
        anioAcademicoId: anioId,
        rigeDesdeId,
        nombre: NOMBRE_METODO[datos.metodo],
        metodo: datos.metodo,
        criterioDesempate: criterio,
        configuracion: { ...configuracionDeRegla(datos.metodo), registradaPor: admin.personaId },
        version: (versiones[0]?.version ?? 0) + 1,
      },
      tx,
    );
    const resumen = (r: ReglaFila) => ({
      version: r.version,
      metodo: r.metodo,
      criterioDesempate: r.criterioDesempate,
      rigeDesde: r.rigeDesde?.nombre ?? null,
    });
    await registrarAuditoria(
      tx,
      {
        usuarioId: admin.usuarioId,
        entidad: "regla_consolidacion",
        entidadId: nueva.id,
        accion: "CREAR_VERSION_REGLA_CONSOLIDACION",
        anterior: vigente ? resumen(vigente) : null,
        nuevo: { anio: anio.anio, ...resumen(nueva) },
      },
      meta,
    );
  });
  return reglasDelAnio(anioId);
}

/**
 * Vista previa de AD-05: aplica la regla a logros de ejemplo con la misma función que usará el cierre (US39).
 * Devuelve el logro, la frecuencia de cada logro, los empatados y, en el ponderado, el promedio sin redondear.
 */
export function simularConsolidacion(datos: {
  metodo: MetodoConsolidacion;
  criterioDesempate?: CriterioDesempate;
  logros: Logro[];
  pesos?: (number | null)[];
}) {
  const regla = { metodo: datos.metodo, criterioDesempate: datos.criterioDesempate ?? "MAYOR_JERARQUIA" };
  const logro = consolidarLogro(datos.logros, regla, datos.pesos);
  const empatados = logrosMasFrecuentes(datos.logros);
  return {
    logro,
    frecuencias: frecuencias(datos.logros),
    empatados: empatados.length > 1 ? empatados : [],
    promedio: datos.metodo === "PONDERADO" ? promedioPonderado(datos.logros, datos.pesos) : null,
  };
}
