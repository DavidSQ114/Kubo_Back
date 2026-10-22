// Pruebas de esDuplicado (platform/db): reconoce la clave duplicada con y sin el adaptador de PostgreSQL.
import { describe, expect, it } from "vitest";
import { esDuplicado } from "@/platform/db/tipos";

const conAdaptador = (indice: string) => ({
  code: "P2002",
  meta: {
    modelName: "AnioAcademico",
    driverAdapterError: { cause: { kind: "UniqueConstraintViolation", constraint: { index: indice } } },
  },
});

describe("esDuplicado (P2002)", () => {
  it("reconoce el índice cuando Prisma usa @prisma/adapter-pg", () => {
    expect(esDuplicado(conAdaptador("uq_anio_en_curso"), "uq_anio_en_curso")).toBe(true);
    expect(esDuplicado(conAdaptador("usuario_email_key"), "email")).toBe(true);
    expect(esDuplicado(conAdaptador("anio_academico_anio_key"), "uq_anio_en_curso")).toBe(false);
  });
  it("reconoce el campo cuando Prisma informa meta.target", () => {
    expect(esDuplicado({ code: "P2002", meta: { target: ["email"] } }, "email")).toBe(true);
    expect(esDuplicado({ code: "P2002", meta: { target: ["dni"] } }, "email")).toBe(false);
  });
  it("sin campo, basta con que sea P2002; otros errores no cuentan", () => {
    expect(esDuplicado({ code: "P2002" })).toBe(true);
    expect(esDuplicado({ code: "P2025" }, "email")).toBe(false);
    expect(esDuplicado(new Error("otro"))).toBe(false);
  });
});
