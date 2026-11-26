// Documentos de la matrícula directa de un alumno nuevo en «Matrícula»: cuándo se piden los documentos del proceso de
// matrícula del año y cómo se validan los archivos que adjunta la coordinación (recibidos en secretaría).
import { describe, expect, it } from "vitest";
import {
  documentosParaMatriculaDirecta,
  NOMBRE_ORIGEN_SOLICITUD,
  verificarDocumentosDirectos,
} from "@/modules/matricula/domain/solicitudes";

// nombres inventados: nada debe depender de «Partida» ni de «DNI»
const requeridos = [
  { id: "a", nombre: "Ficha de salud escolar", obligatorio: true },
  { id: "b", nombre: "Constancia de vacunas", obligatorio: true },
  { id: "c", nombre: "Foto tamaño carné", obligatorio: false },
];

const codigo = (fn: () => void) => {
  try {
    fn();
  } catch (e) {
    return (e as { codigo: string; detalles?: unknown }).codigo;
  }
  return null;
};

describe("documentos que se piden al matricular directamente", () => {
  it("a un alumno nuevo sin solicitud en línea se le piden los documentos activos del proceso, en su orden", () => {
    const r = documentosParaMatriculaDirecta({ esAlumnoNuevo: true, tieneSolicitud: false, requeridos });
    expect(r.map((d) => d.nombre)).toEqual(["Ficha de salud escolar", "Constancia de vacunas", "Foto tamaño carné"]);
  });

  it("a un alumno antiguo no se le piden documentos", () => {
    expect(documentosParaMatriculaDirecta({ esAlumnoNuevo: false, tieneSolicitud: false, requeridos })).toEqual([]);
  });

  it("con solicitud en línea no se piden: sus documentos se revisan en la bandeja", () => {
    expect(documentosParaMatriculaDirecta({ esAlumnoNuevo: true, tieneSolicitud: true, requeridos })).toEqual([]);
  });

  it("si el año no tiene proceso (lista vacía), la matrícula sigue como siempre", () => {
    expect(documentosParaMatriculaDirecta({ esAlumnoNuevo: true, tieneSolicitud: false, requeridos: [] })).toEqual([]);
  });
});

describe("validación de los archivos adjuntos en la matrícula directa", () => {
  it("con los obligatorios basta: el opcional puede faltar", () => {
    expect(codigo(() => verificarDocumentosDirectos(requeridos, ["a", "b"]))).toBeNull();
    expect(codigo(() => verificarDocumentosDirectos(requeridos, ["a", "b", "c"]))).toBeNull();
  });

  it("sin un obligatorio responde DOCUMENTO_FALTANTE y nombra todos los que faltan", () => {
    try {
      verificarDocumentosDirectos(requeridos, ["c"]);
      expect.unreachable();
    } catch (e) {
      const error = e as { codigo: string; message: string; detalles: { nombres: string[] } };
      expect(error.codigo).toBe("DOCUMENTO_FALTANTE");
      expect(error.detalles.nombres).toEqual(["Ficha de salud escolar", "Constancia de vacunas"]);
      expect(error.message).toContain("«Constancia de vacunas»");
    }
  });

  it("un archivo de un documento que no es del proceso responde DOCUMENTO_NO_REQUERIDO", () => {
    expect(codigo(() => verificarDocumentosDirectos(requeridos, ["a", "b", "x"]))).toBe("DOCUMENTO_NO_REQUERIDO");
  });

  it("si no se piden documentos, no se acepta ningún adjunto (DOCUMENTOS_NO_CORRESPONDEN)", () => {
    expect(codigo(() => verificarDocumentosDirectos([], []))).toBeNull();
    expect(codigo(() => verificarDocumentosDirectos([], ["a"]))).toBe("DOCUMENTOS_NO_CORRESPONDEN");
  });

  it("el origen se muestra como «En línea» o «Recibido en secretaría»", () => {
    expect(NOMBRE_ORIGEN_SOLICITUD).toEqual({ EN_LINEA: "En línea", PRESENCIAL: "Recibido en secretaría" });
  });
});
