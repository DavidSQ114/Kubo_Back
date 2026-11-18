// Pruebas de la solicitud de rectificación de nota (US41) y de la bitácora de notas (US03): quién y cuándo se puede
// pedir o resolver una rectificación, recálculo con los pesos usados al cerrar, columnas de las competencias, rango
// de fechas de la bitácora en hora de Lima, validación de entradas y error del trigger de inmutabilidad.
// Ejecutar: npm test
import { describe, expect, it } from "vitest";
import { clasificarError } from "@/platform/http/clasificador";
import type { ErrorApp } from "@/platform/http/errores";
import type { ReglaDelBimestre } from "@/modules/academico";
import { esquemasEvaluacion } from "@/modules/evaluacion";
import { entradaDeBitacora } from "@/modules/evaluacion/application/bitacora";
import { consolidarAlumno } from "@/modules/evaluacion/application/registroNotas";
import {
  columnaDeCompetencia,
  columnasDelRegistro,
  esPendiente,
  NOMBRE_ESTADO_SOLICITUD,
  NOMBRE_ORIGEN,
  pesosDelCierre,
  rangoDeFechas,
  verificarResolucion,
  verificarSolicitud,
  verificarValorVigente,
} from "@/modules/evaluacion/domain/rectificacion";

const DOCENTE = "11111111-1111-4111-8111-111111111111";
const ADMIN = "22222222-2222-4222-8222-222222222222";
const C1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const C2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C3 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function errorDe(fn: () => unknown): ErrorApp {
  try {
    fn();
  } catch (e) {
    return e as ErrorApp;
  }
  throw new Error("Se esperaba un error");
}

describe("solicitar rectificación de una nota (US41, criterio 1)", () => {
  const valida = { estadoRegistro: "CERRADO" as const, logroActual: "B" as const, valorCorrecto: "A" as const };

  it("se pide en un registro CERRADO o PUBLICADO con un valor distinto del registrado", () => {
    expect(() => verificarSolicitud({ ...valida, hayPendiente: false })).not.toThrow();
    expect(() => verificarSolicitud({ ...valida, estadoRegistro: "PUBLICADO", hayPendiente: false })).not.toThrow();
  });

  it("en un registro abierto no hay rectificación: la nota se corrige directamente (409)", () => {
    const e = errorDe(() => verificarSolicitud({ ...valida, estadoRegistro: "ABIERTO", hayPendiente: false }));
    expect(e).toMatchObject({ codigo: "REGISTRO_ABIERTO", estadoHttp: 409 });
  });

  it("rechaza una nota que no existe en el registro y un valor igual al actual", () => {
    expect(errorDe(() => verificarSolicitud({ ...valida, logroActual: null, hayPendiente: false }))).toMatchObject({
      codigo: "NOTA_FUERA_DEL_REGISTRO",
      estadoHttp: 422,
    });
    const igual = errorDe(() => verificarSolicitud({ ...valida, valorCorrecto: "B", hayPendiente: false }));
    expect(igual).toMatchObject({ codigo: "VALOR_IGUAL_AL_ACTUAL", estadoHttp: 422 });
    expect(igual.message).toBe("El valor correcto debe ser distinto del registrado (B).");
  });

  it("admite una sola solicitud pendiente por nota (409)", () => {
    const e = errorDe(() => verificarSolicitud({ ...valida, hayPendiente: true }));
    expect(e).toMatchObject({ codigo: "RECTIFICACION_PENDIENTE", estadoHttp: 409 });
    expect(e.message).toBe("Ya hay una solicitud de rectificación pendiente de aprobación para esta nota.");
  });

  it("el estado inicial se muestra «Pendiente de aprobación» y el rechazo, «Rechazada»", () => {
    expect(NOMBRE_ESTADO_SOLICITUD.PENDIENTE).toBe("Pendiente de aprobación");
    expect(NOMBRE_ESTADO_SOLICITUD.RECHAZADA).toBe("Rechazada");
    expect(NOMBRE_ESTADO_SOLICITUD.APROBADA).toBe("Aprobada");
    expect(esPendiente("PENDIENTE")).toBe(true);
    expect(esPendiente("EN_REVISION")).toBe(true);
    expect(esPendiente("APROBADA")).toBe(false);
  });
});

describe("aprobar o rechazar una rectificación (US41, criterios 2 y 3)", () => {
  it("el administrador resuelve una solicitud pendiente de otro usuario", () => {
    expect(() =>
      verificarResolucion({ estado: "PENDIENTE", solicitadoPorId: DOCENTE, usuarioId: ADMIN }),
    ).not.toThrow();
  });

  it("nadie aprueba ni rechaza su propia solicitud (403)", () => {
    const e = errorDe(() => verificarResolucion({ estado: "PENDIENTE", solicitadoPorId: ADMIN, usuarioId: ADMIN }));
    expect(e).toMatchObject({ codigo: "SOLICITUD_PROPIA", estadoHttp: 403 });
  });

  it("una solicitud ya aprobada o rechazada no se resuelve otra vez (409)", () => {
    const e = errorDe(() => verificarResolucion({ estado: "APROBADA", solicitadoPorId: DOCENTE, usuarioId: ADMIN }));
    expect(e).toMatchObject({ codigo: "SOLICITUD_YA_RESUELTA", estadoHttp: 409 });
    expect(e.message).toBe("Esta solicitud ya fue atendida: está «Aprobada».");
    expect(
      errorDe(() => verificarResolucion({ estado: "RECHAZADA", solicitadoPorId: DOCENTE, usuarioId: ADMIN })).message,
    ).toContain("«Rechazada»");
  });

  it("al aprobar, la nota debe tener todavía el valor con el que se pidió", () => {
    expect(() => verificarValorVigente("B", "B")).not.toThrow();
    expect(errorDe(() => verificarValorVigente("C", "B"))).toMatchObject({ codigo: "NOTA_CAMBIO", estadoHttp: 409 });
  });
});

describe("recálculo del consolidado con la regla y los pesos usados al cerrar (US41, criterio 2)", () => {
  const competencias = [
    { competenciaPlanId: C1, codigo: "MAT-C1", nombre: "Cantidad", orden: 1, peso: 1 },
    { competenciaPlanId: C2, codigo: "MAT-C2", nombre: "Regularidad", orden: 2, peso: 1 },
    { competenciaPlanId: C3, codigo: "MAT-C3", nombre: "Forma", orden: 3, peso: 1 },
  ];
  const detalle = {
    regla: { version: 2, metodo: "PONDERADO" },
    logros: [
      { competencia: "MAT-C1", logro: "C", peso: 2 },
      { competencia: "MAT-C2", logro: "AD", peso: 1 },
    ],
  };

  it("toma el peso de cada competencia del detalle del cierre y conserva el actual si no está", () => {
    expect(pesosDelCierre(competencias, detalle).map((c) => c.peso)).toEqual([2, 1, 1]);
    expect(pesosDelCierre(competencias, null).map((c) => c.peso)).toEqual([1, 1, 1]);
  });

  it("con los pesos del cierre, subir C1 de C a A cambia el consolidado ponderado", () => {
    const regla: ReglaDelBimestre = {
      id: "r",
      version: 2,
      nombre: "Ponderado",
      metodo: "PONDERADO",
      criterioDesempate: "MAYOR_JERARQUIA",
    };
    const fecha = new Date("2026-07-20T15:00:00Z");
    const nota = (competenciaPlanId: string, logro: "AD" | "A" | "B" | "C") => ({
      competenciaPlanId,
      logro,
      createdAt: fecha,
      modificadoEn: null,
    });
    const pesos = pesosDelCierre(competencias, detalle);
    // antes: (1×2 + 4 + 2) / 4 = 2 → B · después: (3×2 + 4 + 2) / 4 = 3 → A
    expect(consolidarAlumno(regla, pesos, [nota(C1, "C"), nota(C2, "AD"), nota(C3, "B")]).logro).toBe("B");
    expect(consolidarAlumno(regla, pesos, [nota(C1, "A"), nota(C2, "AD"), nota(C3, "B")]).logro).toBe("A");
  });
});

describe("bitácora de notas (US03)", () => {
  it("numera las competencias C1, C2… por el orden del plan, como en el registro", () => {
    const columnas = columnasDelRegistro([
      { competenciaPlanId: C3, codigo: "MAT-C3", nombre: "Forma", orden: 7 },
      { competenciaPlanId: C1, codigo: "MAT-C1", nombre: "Cantidad", orden: 2 },
    ]);
    expect(columnas.get(C1)).toEqual({ columna: 1, codigo: "MAT-C1", nombre: "Cantidad" });
    expect(columnaDeCompetencia(columnas.get(C3)!.columna)).toBe("C2");
  });

  it("guarda quién, curso, sección, bimestre, estudiante, competencia, valor anterior y nuevo, y el origen", () => {
    const e = entradaDeBitacora(
      {
        usuarioId: ADMIN,
        usuarioNombre: "Rosa Huamán Torres",
        docenteId: DOCENTE,
        docenteNombre: "Juan Pérez Salazar",
        anio: 2026,
        curso: { codigo: "MAT", nombre: "Matemática" },
        seccion: "2° A",
        bimestre: { numero: 2, nombre: "Bimestre II" },
        origen: "RECTIFICACION",
        solicitudId: C3,
      },
      {
        notaId: C1,
        cierreId: C2,
        matriculaId: DOCENTE,
        competenciaPlanId: C2,
        anterior: "B",
        nuevo: "A",
        estudiante: "Paredes Gómez, Lucía",
        competencia: { columna: 2, codigo: "MAT-C2", nombre: "Regularidad" },
      },
    );
    expect(e).toMatchObject({
      origen: "RECTIFICACION",
      solicitudId: C3,
      logroAnterior: "B",
      logroNuevo: "A",
      usuarioNombre: "Rosa Huamán Torres",
      docenteNombre: "Juan Pérez Salazar",
      cursoNombre: "Matemática",
      seccion: "2° A",
      bimestreNumero: 2,
      estudianteNombre: "Paredes Gómez, Lucía",
      competenciaColumna: 2,
    });
    expect(NOMBRE_ORIGEN[e.origen]).toBe("Rectificación aprobada");
    expect(NOMBRE_ORIGEN.REGISTRO).toBe("Registro docente");
  });

  it("el rango de fechas va de las 00:00 de «desde» al fin del día de «hasta», en hora de Lima", () => {
    const r = rangoDeFechas("2026-09-01", "2026-09-16");
    expect(r.desde?.toISOString()).toBe("2026-09-01T05:00:00.000Z");
    expect(r.hasta?.toISOString()).toBe("2026-09-17T05:00:00.000Z");
    expect(rangoDeFechas("2026-09-16", "2026-09-16").hasta?.toISOString()).toBe("2026-09-17T05:00:00.000Z");
    expect(rangoDeFechas()).toEqual({ desde: undefined, hasta: undefined });
  });

  it("rechaza un rango al revés (400)", () => {
    const e = errorDe(() => rangoDeFechas("2026-09-16", "2026-09-01"));
    expect(e).toMatchObject({ codigo: "RANGO_FECHAS_INVALIDO", estadoHttp: 400 });
  });

  it("un intento de cambiar o borrar la bitácora directo en la base se convierte en un error legible", () => {
    const c = clasificarError(new Error("BITACORA_NOTA_INMUTABLE: la bitácora de notas no se modifica ni se borra"));
    expect(c).toMatchObject({ codigo: "BITACORA_NOTA_INMUTABLE", estado: 422 });
    expect(c.mensaje).toBe("La bitácora de notas no se puede modificar.");
  });
});

describe("validación de entradas (US41, US03, RNF16)", () => {
  const cuerpo = { matriculaId: DOCENTE, competenciaPlanId: C1, valorCorrecto: "A", motivo: "Error de digitación" };

  it("la solicitud exige estudiante, competencia, un valor de la escala y el motivo", () => {
    expect(esquemasEvaluacion.SolicitarRectificacionSchema.parse(cuerpo)).toEqual(cuerpo);
    const sinMotivo = esquemasEvaluacion.SolicitarRectificacionSchema.safeParse({ ...cuerpo, motivo: "   " });
    expect(sinMotivo.success).toBe(false);
    expect(sinMotivo.error?.issues[0].message).toBe("Escribe el motivo del error");
    const fuera = esquemasEvaluacion.SolicitarRectificacionSchema.safeParse({ ...cuerpo, valorCorrecto: "15" });
    expect(fuera.error?.issues[0].message).toBe("Solo se permiten los valores AD, A, B o C");
    const largo = esquemasEvaluacion.SolicitarRectificacionSchema.safeParse({ ...cuerpo, motivo: "x".repeat(501) });
    expect(largo.success).toBe(false);
  });

  it("el rechazo exige motivo", () => {
    const r = esquemasEvaluacion.RechazarRectificacionSchema.safeParse({ motivo: "" });
    expect(r.error?.issues[0].message).toBe("Escribe el motivo del rechazo");
    expect(esquemasEvaluacion.RechazarRectificacionSchema.parse({ motivo: " Sin sustento " })).toEqual({
      motivo: "Sin sustento",
    });
  });

  it("los filtros vacíos de la bitácora se ignoran y una fecha inválida se rechaza", () => {
    expect(esquemasEvaluacion.FiltroBitacoraSchema.parse({ desde: "", hasta: "", docenteId: "" })).toEqual({
      desde: undefined,
      hasta: undefined,
      docenteId: undefined,
      pagina: 1,
      tamano: 20,
    });
    expect(esquemasEvaluacion.FiltroBitacoraSchema.safeParse({ desde: "2026-02-30" }).success).toBe(false);
    expect(esquemasEvaluacion.BandejaRectificacionesSchema.parse({}).estado).toBe("PENDIENTES");
  });
});
