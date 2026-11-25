// Pruebas de la solicitud de matrícula del apoderado y la revisión de sus documentos (bloque M4 · fases 6 y 7).
// Ejecutar: npm test
import { describe, expect, it } from "vitest";
import {
  estadoSegunDocumentos,
  revisarDocumento,
  verificarDocumentosEnviados,
  verificarListaParaAsignar,
  verificarPuedeMatricular,
  verificarReemplazable,
  verificarSolicitudAbierta,
} from "@/modules/matricula/domain/solicitudes";

const requeridos = [
  { id: "partida", nombre: "Partida de nacimiento", obligatorio: true },
  { id: "dni", nombre: "DNI del alumno", obligatorio: true },
  { id: "noAdeudo", nombre: "Constancia de no adeudo", obligatorio: false },
];
const subido = (documentoRequeridoId: string, estado: "EN_REVISION" | "APROBADO" | "OBSERVADO") => ({
  documentoRequeridoId,
  estado,
});

describe("quién puede matricular a su hijo (bloque M4)", () => {
  it("sin matrícula vigente se crea una nueva", () => {
    expect(verificarPuedeMatricular(null, 2027)).toBe("CREAR");
  });
  it("con el borrador del registro (En proceso sin solicitud) se completa", () => {
    expect(verificarPuedeMatricular({ estado: "EN_PROCESO", tieneSolicitud: false }, 2027)).toBe("COMPLETAR");
  });
  it("con la matrícula confirmada o la solicitud ya enviada, no", () => {
    expect(() => verificarPuedeMatricular({ estado: "MATRICULADO", tieneSolicitud: false }, 2027)).toThrow(
      "Tu hijo ya está matriculado en 2027.",
    );
    expect(() => verificarPuedeMatricular({ estado: "EN_PROCESO", tieneSolicitud: true }, 2027)).toThrow(
      "Ya enviaste la solicitud de matrícula 2027",
    );
  });
});

describe("documentos enviados con la solicitud (bloque M4)", () => {
  it("bastan los obligatorios; el opcional puede faltar", () => {
    expect(() => verificarDocumentosEnviados(requeridos, ["partida", "dni"])).not.toThrow();
  });
  it("nombra el obligatorio que falta", () => {
    expect(() => verificarDocumentosEnviados(requeridos, ["partida", "noAdeudo"])).toThrow(
      "Sube el documento «DNI del alumno».",
    );
  });
  it("rechaza un documento que no está en la lista del proceso", () => {
    expect(() => verificarDocumentosEnviados(requeridos, ["partida", "dni", "otro"])).toThrow("no está en la lista");
  });
});

describe("revisión de cada documento (bloque M4)", () => {
  it("aprueba sin observación y observa con el motivo", () => {
    expect(revisarDocumento("EN_REVISION", "APROBAR")).toEqual({ estado: "APROBADO", observacion: null });
    expect(revisarDocumento("EN_REVISION", "OBSERVAR", "  La foto no se lee ")).toEqual({
      estado: "OBSERVADO",
      observacion: "La foto no se lee",
    });
  });
  it("observar exige el motivo y un documento ya revisado no se vuelve a revisar", () => {
    expect(() => revisarDocumento("EN_REVISION", "OBSERVAR", " ")).toThrow("Escribe qué debe corregir");
    expect(() => revisarDocumento("APROBADO", "OBSERVAR", "x")).toThrow("ya está «Aprobado»");
  });
  it("el apoderado reemplaza un observado o sube uno que faltaba, pero no uno en revisión o aprobado", () => {
    expect(() => verificarReemplazable("OBSERVADO")).not.toThrow();
    expect(() => verificarReemplazable(null)).not.toThrow();
    expect(() => verificarReemplazable("EN_REVISION")).toThrow("Solo puedes reemplazar");
    expect(() => verificarReemplazable("APROBADO")).toThrow("Solo puedes reemplazar");
  });
  it("una solicitud matriculada o anulada ya no cambia", () => {
    expect(() => verificarSolicitudAbierta("MATRICULADA")).toThrow("ya fue resuelta");
    expect(() => verificarSolicitudAbierta("OBSERVADA")).not.toThrow();
  });
});

describe("estado de la solicitud y asignación de la sección (bloque M4)", () => {
  it("con un documento observado queda «Con observaciones»", () => {
    expect(estadoSegunDocumentos(requeridos, [subido("partida", "APROBADO"), subido("dni", "OBSERVADO")])).toBe(
      "OBSERVADA",
    );
  });
  it("con todos los obligatorios aprobados queda «Documentos aprobados» aunque el opcional falte", () => {
    expect(estadoSegunDocumentos(requeridos, [subido("partida", "APROBADO"), subido("dni", "APROBADO")])).toBe(
      "APROBADA",
    );
  });
  it("si falta revisar alguno sigue «Documentos en revisión»", () => {
    expect(estadoSegunDocumentos(requeridos, [subido("partida", "APROBADO"), subido("dni", "EN_REVISION")])).toBe(
      "EN_REVISION",
    );
  });
  it("solo se asigna la sección con los obligatorios aprobados; nombra los que faltan", () => {
    expect(() => verificarListaParaAsignar(requeridos, [subido("partida", "APROBADO")])).toThrow(
      "deben estar aprobados: DNI del alumno.",
    );
    expect(() =>
      verificarListaParaAsignar(requeridos, [subido("partida", "APROBADO"), subido("dni", "APROBADO")]),
    ).not.toThrow();
  });
});
