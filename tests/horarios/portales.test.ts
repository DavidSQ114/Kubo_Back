// Reglas de «Mi horario» en los portales: resumen del horario del docente (US34, DO-02). Sin base de datos.
import { describe, expect, it } from "vitest";
import { resumenDelDocente } from "@/modules/horarios/domain/portales";

const clase = (id: string, etiqueta: string) => ({ seccion: { id, etiqueta } });

describe("resumen del horario del docente (US34, DO-02)", () => {
  it("cuenta los bloques de todas sus secciones publicadas y lista las secciones sin repetir", () => {
    const r = resumenDelDocente([
      clase("s3a", "3° A"),
      clase("s2b", "2° B"),
      clase("s3a", "3° A"),
      clase("s2a", "2° A"),
    ]);
    expect(r).toEqual({ bloques: 4, secciones: ["2° A", "2° B", "3° A"] });
  });

  it("ordena los grados como números: 2° va antes que 10°", () => {
    expect(resumenDelDocente([clase("x", "10° A"), clase("y", "2° A")]).secciones).toEqual(["2° A", "10° A"]);
  });

  it("dos secciones distintas con la misma etiqueta (años distintos) no se mezclan", () => {
    expect(resumenDelDocente([clase("s1", "1° A"), clase("s2", "1° A")]).secciones).toEqual(["1° A", "1° A"]);
  });

  it("sin clases publicadas queda en cero: «Aún no tienes cursos asignados para este periodo»", () => {
    expect(resumenDelDocente([])).toEqual({ bloques: 0, secciones: [] });
  });
});
