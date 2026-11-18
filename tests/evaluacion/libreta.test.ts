// Pruebas de las reglas de la publicación de notas (US39, criterio 4) y de la libreta del apoderado y del alumno
// (US46, US51, US66): cursos publicados y pendientes, estado y resumen del bimestre, bimestre por defecto y PDF.
import { describe, expect, it } from "vitest";
import {
  bimestrePorDefecto,
  cursosDelBimestre,
  estadoDelBimestre,
  nombreArchivoLibreta,
  resumenDeLogros,
  verificarLibretaDescargable,
  verificarPublicable,
  type CursoPublicadoEntrada,
} from "@/modules/evaluacion/domain/libreta";
import { filasDelHorario } from "@/modules/horarios/application/horarioPdf";

function esperarError(fn: () => void, codigo: string) {
  expect(fn).toThrowError(expect.objectContaining({ codigo }));
}

const MATEMATICA: CursoPublicadoEntrada = {
  cursoId: "mat",
  codigo: "MAT",
  nombre: "Matemática",
  docente: "Juan Pérez Salazar",
  publicadoEn: new Date("2026-07-27T15:00:00Z"),
  consolidado: "AD",
  competencias: [
    { competenciaPlanId: "c2", codigo: "C2", nombre: "Regularidad", orden: 2 },
    { competenciaPlanId: "c1", codigo: "C1", nombre: "Cantidad", orden: 1 },
  ],
  notas: { c1: "AD", c2: "A" },
};

const PLAN = [
  { cursoId: "mat", codigo: "MAT", nombre: "Matemática", docente: "Juan Pérez Salazar" },
  { cursoId: "com", codigo: "COM", nombre: "Comunicación", docente: "Mónica Torres" },
  { cursoId: "efi", codigo: "EFI", nombre: "Educación Física", docente: null },
];

describe("publicación de notas (US39, criterio 4)", () => {
  it("solo publica un registro cerrado por el docente", () => {
    expect(() => verificarPublicable("CERRADO")).not.toThrow();
  });

  it("rechaza un registro abierto y uno ya publicado", () => {
    esperarError(() => verificarPublicable("ABIERTO"), "REGISTRO_NO_CERRADO");
    esperarError(() => verificarPublicable("PUBLICADO"), "REGISTRO_YA_PUBLICADO");
  });
});

describe("cursos del bimestre en la libreta (US46 criterio 2, US51 criterio 2)", () => {
  const cursos = cursosDelBimestre([MATEMATICA], PLAN);

  it("el curso publicado trae sus logros por competencia en el orden del plan y su consolidado", () => {
    const mat = cursos.find((c) => c.cursoId === "mat")!;
    expect(mat).toMatchObject({ publicado: true, consolidado: "AD", publicadoEn: "2026-07-27T15:00:00.000Z" });
    expect(mat.competencias.map((c) => [c.codigo, c.logro])).toEqual([
      ["C1", "AD"],
      ["C2", "A"],
    ]);
  });

  it("los cursos del plan sin publicar aparecen sin ninguna calificación", () => {
    const pendientes = cursos.filter((c) => !c.publicado);
    expect(pendientes.map((c) => c.nombre)).toEqual(["Comunicación", "Educación Física"]);
    expect(pendientes.every((c) => c.consolidado === null && c.competencias.length === 0)).toBe(true);
  });

  it("un curso publicado no se repite como pendiente y la lista va por nombre", () => {
    expect(cursos.map((c) => c.nombre)).toEqual(["Comunicación", "Educación Física", "Matemática"]);
  });

  it("un curso publicado de una sección anterior (traslado) se muestra aunque no esté en el plan actual", () => {
    const otro = { ...MATEMATICA, cursoId: "ing", nombre: "Inglés", codigo: "ING" };
    expect(cursosDelBimestre([otro], []).map((c) => [c.nombre, c.publicado])).toEqual([["Inglés", true]]);
  });

  it("una competencia sin nota (agregada después del cierre) queda sin logro", () => {
    const sinNota = { ...MATEMATICA, notas: { c1: "AD" as const } };
    const mat = cursosDelBimestre([sinNota], [])[0];
    expect(mat.competencias.find((c) => c.codigo === "C2")?.logro).toBeNull();
  });
});

describe("estado y resumen del bimestre (AP-04, AL-03)", () => {
  const hoy = "2026-09-16";

  it("publicado si todos sus cursos lo están, parcial si algunos y pendiente si ninguno", () => {
    const b = { fechaInicio: "2026-05-25" };
    expect(estadoDelBimestre(b, [{ publicado: true }, { publicado: true }], hoy)).toBe("PUBLICADO");
    expect(estadoDelBimestre(b, [{ publicado: true }, { publicado: false }], hoy)).toBe("PARCIAL");
    expect(estadoDelBimestre(b, [{ publicado: false }], hoy)).toBe("PENDIENTE");
  });

  it("un bimestre que aún no empieza y no tiene nada publicado no está pendiente", () => {
    expect(estadoDelBimestre({ fechaInicio: "2026-10-19" }, [{ publicado: false }], hoy)).toBe("NO_INICIADO");
  });

  it("el resumen cuenta los cursos publicados por logro consolidado", () => {
    const cursos = cursosDelBimestre(
      [MATEMATICA, { ...MATEMATICA, cursoId: "cyt", nombre: "Ciencia", consolidado: "A" }],
      PLAN,
    );
    expect(resumenDeLogros(cursos)).toEqual({ AD: 1, A: 1, B: 0, C: 0 });
  });

  it("abre el último bimestre con algo publicado y, si no hay, el último que ya empezó", () => {
    const bimestres = [
      { id: "b1", numero: 1, fechaInicio: "2026-03-09", estado: "PUBLICADO" as const },
      { id: "b2", numero: 2, fechaInicio: "2026-05-25", estado: "PARCIAL" as const },
      { id: "b3", numero: 3, fechaInicio: "2026-08-10", estado: "PENDIENTE" as const },
      { id: "b4", numero: 4, fechaInicio: "2026-10-19", estado: "NO_INICIADO" as const },
    ];
    expect(bimestrePorDefecto(bimestres, hoy)?.id).toBe("b2");
    const sinPublicar = bimestres.map((b) => ({ ...b, estado: "PENDIENTE" as const }));
    expect(bimestrePorDefecto(sinPublicar, hoy)?.id).toBe("b3");
    expect(bimestrePorDefecto(sinPublicar, "2026-01-10")?.id).toBe("b1");
    expect(bimestrePorDefecto([], hoy)).toBeNull();
  });
});

describe("libreta y horario en PDF (US66)", () => {
  it("la libreta se descarga con al menos un curso publicado en el bimestre", () => {
    expect(() => verificarLibretaDescargable([{ publicado: false }, { publicado: true }])).not.toThrow();
  });

  it("sin cursos publicados no se genera el archivo", () => {
    esperarError(() => verificarLibretaDescargable([{ publicado: false }]), "LIBRETA_SIN_PUBLICAR");
    esperarError(() => verificarLibretaDescargable([]), "LIBRETA_SIN_PUBLICAR");
  });

  it("el nombre del archivo no lleva tildes ni espacios", () => {
    expect(
      nombreArchivoLibreta({ bimestre: "Bimestre II", anio: 2026, nombres: "Valeria Sofía", apellidos: "Ñique Ríos" }),
    ).toBe("Libreta_BimestreII_2026_ValeriaNique.pdf");
  });

  it("el horario tiene una fila por bloque, con curso, aula y docente por día y el recreo en su fila", () => {
    const filas = filasDelHorario({
      bloques: [
        { id: "r", orden: 2, horaInicio: "10:00", horaFin: "10:20", tipo: "RECREO", etiqueta: "Recreo" },
        { id: "b1", orden: 1, horaInicio: "07:45", horaFin: "08:30", tipo: "CLASE", etiqueta: "1.ª hora" },
      ],
      clases: [
        {
          id: "x",
          dia: "MARTES",
          bloqueId: "b1",
          curso: { id: "mat", codigo: "MAT", nombre: "Matemática" },
          docente: { id: "d", nombreCompleto: "Juan Pérez", nombreCorto: "J. Pérez" },
          aula: { id: "a", nombre: "Aula 201" },
          seccion: { id: "s", etiqueta: "3° B" },
          asignacionActiva: true,
        },
      ],
    });
    expect(filas[0]).toEqual(["07:45 – 08:30", "—", "Matemática · Aula 201 · J. Pérez", "—", "—", "—"]);
    expect(filas[1]).toEqual(["10:00 – 10:20", "Recreo", "", "", "", ""]);
  });
});
