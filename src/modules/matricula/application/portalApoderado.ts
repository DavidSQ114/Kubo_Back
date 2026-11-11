// matricula/application: portal del apoderado (solo lectura). Hijos que puede consultar y estudiante elegido (US42,
// AC-05), cronograma con estados y resumen (US43, AP-02) y comprobante de una cuota pagada (US44). Cada consulta
// vuelve a calcular en el servidor los hijos vinculados a la persona en sesión: un estudiante ajeno responde 403.
import { prisma } from "@/platform/db/prisma";
import { registrarAuditoria } from "@/platform/auditoria";
import { firmarEstudianteElegido, verificarEstudianteElegido } from "@/platform/auth/jwt";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { aCentimos, deCentimos, fechaEnLima, listarSecciones, obtenerAnio } from "@/modules/academico";
import { estudiantesVinculadosAPersona, type EstudianteVinculado } from "@/modules/comunidad";
import type { Autenticado } from "@/modules/identidad";
import { erroresMatricula as E } from "../domain/errores";
import { NOMBRE_ESTADO_MATRICULA } from "../domain/matriculas";
import {
  estadoCuotaPortal,
  matriculasDelPortal,
  NOMBRE_ESTADO_CUOTA_PORTAL,
  nombreArchivoComprobante,
  resumenPagos,
  verificarComprobanteDisponible,
  verificarHijoAutorizado,
} from "../domain/portalApoderado";
import { cuotas as cuotasMatricula } from "../infrastructure/repositorio";
import { cuotasDePago, matriculasDeEstudiante, operaciones } from "../infrastructure/pagos";
import { esPagoAnual, reciboDePago } from "./pagos";
import { pagoEnLineaDisponible } from "./pasarela";

const iniciales = (nombres: string, apellidos: string) =>
  `${nombres.trim().charAt(0)}${apellidos.trim().charAt(0)}`.toUpperCase();

/** Matrículas del estudiante que el apoderado puede ver, con su año (la del año en curso primero). */
async function matriculasVisibles(estudianteId: string) {
  const todas = await matriculasDeEstudiante(estudianteId);
  const conAnio = await Promise.all(
    todas.map(async (m) => {
      const anio = await obtenerAnio(m.anioAcademicoId);
      return { ...m, anio: anio.anio, estadoAnio: anio.estado };
    }),
  );
  return matriculasDelPortal(conAnio);
}

type MatriculaVisible = Awaited<ReturnType<typeof matriculasVisibles>>[number];

interface HijoAutorizado extends EstudianteVinculado {
  matriculas: MatriculaVisible[];
}

/** Hijos vinculados a la persona que tienen una matrícula visible. Es la lista contra la que se autoriza todo. */
async function hijosAutorizados(personaId: string): Promise<HijoAutorizado[]> {
  const vinculados = await estudiantesVinculadosAPersona(personaId);
  const conMatricula = await Promise.all(
    vinculados.map(async (e) => ({ ...e, matriculas: await matriculasVisibles(e.estudianteId) })),
  );
  return conMatricula.filter((h) => h.matriculas.length > 0);
}

/** El hijo pedido, si está vinculado a la persona en sesión; si no, 403 ESTUDIANTE_NO_VINCULADO. */
export async function hijoAutorizado(auth: Autenticado, estudianteId: string): Promise<HijoAutorizado> {
  const hijos = await hijosAutorizados(auth.personaId);
  verificarHijoAutorizado(
    hijos.map((h) => h.estudianteId),
    estudianteId,
  );
  return hijos.find((h) => h.estudianteId === estudianteId)!;
}

async function seccionDe(m: MatriculaVisible) {
  const seccion = m.seccionId ? (await listarSecciones(m.anioAcademicoId)).find((s) => s.id === m.seccionId) : null;
  return seccion
    ? { grado: seccion.grado.nombre, seccion: seccion.nombre, corta: `${seccion.grado.numero}° ${seccion.nombre}` }
    : null;
}

/** Estudiante elegido guardado en la cookie, si es de este usuario (la cookie no autoriza nada por sí sola). */
async function estudianteDeCookie(auth: Autenticado, token: string | null) {
  const claims = token ? await verificarEstudianteElegido(token) : null;
  return claims && claims.sub === auth.usuarioId ? claims.est : null;
}

// ---------- US42 · Selección de hijo (AC-05) ----------

/**
 * Hijos que el apoderado puede consultar, con nombre, grado y sección, y las pensiones vencidas de cada uno.
 * `seleccionadoId`: el único hijo, o el elegido antes (cookie) si sigue vinculado; con dos o más sin elegir, null.
 */
export async function hijosDelApoderado(auth: Autenticado, tokenElegido: string | null) {
  const [hijos, elegido] = await Promise.all([
    hijosAutorizados(auth.personaId),
    estudianteDeCookie(auth, tokenElegido),
  ]);
  const hoy = fechaEnLima(new Date());
  const vista = await Promise.all(
    hijos.map(async (h) => {
      const m = h.matriculas[0];
      const [seccion, cuotas] = await Promise.all([seccionDe(m), cuotasMatricula.deMatricula(m.id)]);
      return {
        estudianteId: h.estudianteId,
        nombres: h.nombres,
        nombreCompleto: `${h.nombres} ${h.apellidos}`,
        iniciales: iniciales(h.nombres, h.apellidos),
        anio: m.anio,
        estadoMatricula: m.estado,
        nombreEstadoMatricula: NOMBRE_ESTADO_MATRICULA[m.estado],
        grado: seccion?.grado ?? null,
        seccion: seccion?.seccion ?? null,
        seccionCorta: seccion?.corta ?? null,
        cuotasVencidas: cuotas.filter((c) => estadoCuotaPortal(c, hoy) === "VENCIDO").length,
      };
    }),
  );
  const seleccionadoId =
    vista.length === 1 ? vista[0].estudianteId : (vista.find((h) => h.estudianteId === elegido)?.estudianteId ?? null);
  return { hijos: vista, seleccionadoId };
}

/** Elige el hijo a consultar: verifica el vínculo y devuelve el token firmado que la ruta guarda en la cookie. */
export async function elegirHijo(auth: Autenticado, estudianteId: string) {
  await hijoAutorizado(auth, estudianteId);
  return {
    estudianteId,
    token: await firmarEstudianteElegido({ sub: auth.usuarioId, est: estudianteId }),
  };
}

// ---------- US43 · Deudas y pagos (AP-02) ----------

/**
 * Cronograma del hijo (matrícula y pensiones generadas), cada cuota con «Pagado», «Pendiente» o «Vencido», su fecha
 * de pago y si tiene comprobante; las anuladas van aparte. Resumen pagado, pendiente y vencido. Por defecto, el año
 * en curso; `anioId` elige otro de sus años visibles.
 */
export async function pagosDelHijo(auth: Autenticado, estudianteId: string, anioId?: string) {
  const hijo = await hijoAutorizado(auth, estudianteId);
  const m = anioId ? hijo.matriculas.find((x) => x.anioAcademicoId === anioId) : hijo.matriculas[0];
  if (!m) throw E.noEncontrada();

  const hoy = fechaEnLima(new Date());
  const [seccion, lista, ops] = await Promise.all([
    seccionDe(m),
    cuotasMatricula.deMatricula(m.id),
    operaciones.deEstudiante(estudianteId),
  ]);
  const pagoDe = new Map<string, { fechaPago: string; comprobante: string | null }>();
  const enRevision = new Set<string>();
  for (const o of ops.filter((x) => x.matriculaId === m.id)) {
    for (const c of o.cuotas) {
      if (o.estado === "CONFIRMADO")
        pagoDe.set(c.id, { fechaPago: o.fechaPago, comprobante: o.comprobante?.numero ?? null });
      if (o.estado === "OBSERVADO") enRevision.add(c.id);
    }
  }

  const cuotas = lista.map((c) => {
    const estado = estadoCuotaPortal(c, hoy);
    const pago = estado === "PAGADO" ? pagoDe.get(c.id) : undefined;
    return {
      cuotaId: c.id,
      tipo: c.tipo,
      mes: c.mes,
      concepto: c.concepto,
      monto: c.monto,
      fechaVencimiento: c.fechaVencimiento,
      estado,
      nombreEstado: NOMBRE_ESTADO_CUOTA_PORTAL[estado],
      fechaPago: pago?.fechaPago ?? null,
      comprobanteDisponible: Boolean(pago?.comprobante),
      // US23: un pago «Observado» no cuenta como pagado; solo se avisa que tesorería lo está revisando
      enRevision: estado !== "PAGADO" && enRevision.has(c.id),
      // US70: se puede pagar en línea una cuota Pendiente o Vencida que no esté en revisión
      pagable: (estado === "PENDIENTE" || estado === "VENCIDO") && !enRevision.has(c.id),
    };
  });
  const vigentes = cuotas.filter((c) => c.estado !== "ANULADO");
  const r = resumenPagos(vigentes.map((c) => ({ estadoPortal: c.estado, montoCentimos: aCentimos(c.monto) })));

  return {
    estudiante: {
      estudianteId,
      nombres: hijo.nombres,
      nombreCompleto: `${hijo.nombres} ${hijo.apellidos}`,
      codigoPago: hijo.dni,
    },
    matricula: {
      anioId: m.anioAcademicoId,
      anio: m.anio,
      estado: m.estado,
      nombreEstado: NOMBRE_ESTADO_MATRICULA[m.estado],
      fechaMatricula: m.fechaMatricula,
      grado: seccion?.grado ?? null,
      seccion: seccion?.corta ?? null,
    },
    anios: hijo.matriculas.map((x) => ({ anioId: x.anioAcademicoId, anio: x.anio })),
    hoy,
    // US70: el botón «Pagar» solo aparece si hay una pasarela configurada
    pagoEnLinea: pagoEnLineaDisponible(),
    resumen: {
      pagado: deCentimos(r.pagadoCentimos),
      cuotasPagadas: r.cuotasPagadas,
      pendiente: deCentimos(r.pendienteCentimos),
      cuotasPendientes: r.cuotasPendientes,
      vencido: deCentimos(r.vencidoCentimos),
      cuotasVencidas: r.cuotasVencidas,
      alDia: r.alDia,
    },
    cuotas: vigentes,
    anuladas: cuotas.filter((c) => c.estado === "ANULADO"),
  };
}

// ---------- US44 · Comprobante de una cuota pagada ----------

/**
 * PDF de la operación confirmada que pagó la cuota (el mismo recibo de US25), con el nombre
 * Recibo_<Mes><Año>_<Estudiante>.pdf. Solo cuotas «Pagado»; si no, «No se puede generar un recibo de un pago no
 * confirmado». Registra DESCARGAR_COMPROBANTE_APODERADO solo con ids (sin datos personales).
 */
export async function comprobanteDeCuota(
  auth: Autenticado,
  estudianteId: string,
  cuotaId: string,
  meta: MetaSolicitud,
) {
  const hijo = await hijoAutorizado(auth, estudianteId);
  const [cuota] = await cuotasDePago.porIds([cuotaId]);
  const m = cuota && hijo.matriculas.find((x) => x.id === cuota.matriculaId);
  if (!cuota || cuota.estudianteId !== estudianteId || !m) throw E.cuotaNoEncontrada();
  verificarComprobanteDisponible(estadoCuotaPortal(cuota, fechaEnLima(new Date())));

  const op = (await operaciones.deEstudiante(estudianteId)).find(
    (o) => o.estado === "CONFIRMADO" && o.cuotas.some((c) => c.id === cuotaId),
  );
  if (!op?.comprobante) throw E.reciboNoConfirmado();
  const [recibo, anual] = await Promise.all([reciboDePago(op.id), esPagoAnual(op.id)]);
  const nombreArchivo = nombreArchivoComprobante({
    tipo: cuota.tipo,
    mes: cuota.mes,
    anio: m.anio,
    anual,
    nombres: hijo.nombres,
    apellidos: hijo.apellidos,
  });

  const comprobante = op.comprobante;
  await prisma.$transaction((tx) =>
    registrarAuditoria(
      tx,
      {
        usuarioId: auth.usuarioId,
        entidad: "comprobante",
        entidadId: comprobante.id,
        accion: "DESCARGAR_COMPROBANTE_APODERADO",
        nuevo: { estudianteId, cuotaId, operacionId: op.id, comprobante: comprobante.numero },
      },
      meta,
    ),
  );
  return { bytes: recibo.bytes, nombreArchivo };
}
