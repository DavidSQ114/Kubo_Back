// Prueba de integración del bloque M2: ítems de evaluación con pesos. Cálculo de la nota con la regla PONDERADO de
// académico en la misma transacción que las calificaciones, alumno incompleto, confirmación al quitar notas o borrar
// calificaciones, bitácora con origen ITEMS, competencias de mi curso del docente, permisos del docente ajeno (403),
// triggers del registro cerrado en item_evaluacion y calificacion_item, libreta con el detalle de ítems y apoderado con
// deuda (US26), y los reportes del coordinador.
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/evaluacion/items.integracion
// Crea sus propios datos ficticios en el año 2077 (DNI 900024xx) y los borra al terminar (la bitácora de notas y la
// auditoría son inmutables y no se borran). Quien registra, cierra y publica es el administrador del seed con un perfil
// Docente temporal: la auditoría es inmutable y quien la firma no se puede borrar.
import "@/server/wiring";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "@/platform/auth/tokens";
import { prisma } from "@/platform/db/prisma";
import { GET as misCompetenciasRuta } from "@/app/api/v1/academico/mis-cursos/[id]/competencias/route";
import { PUT as itemsRuta } from "@/app/api/v1/evaluacion/registros/[asignacionId]/bimestres/[periodoId]/competencias/[competenciaPlanId]/items/route";
import { PUT as notasRuta } from "@/app/api/v1/evaluacion/registros/[asignacionId]/bimestres/[periodoId]/notas/route";
import { competenciasDeMiCurso, guardarCompetenciasDeMiCurso } from "@/modules/academico";
import {
  cerrarRegistro,
  guardarItems,
  guardarNotas,
  publicarNotas,
  registroDeNotas,
  type LogroNota,
} from "@/modules/evaluacion";
import { iniciarSesion, type Autenticado } from "@/modules/identidad";
import { confirmarMatricula } from "@/modules/matricula";

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
const ANIO = 2077;
// contraseña ficticia de las cuentas que crea la prueba (cumple la política; no es de ninguna cuenta real)
const CLAVE = "Prueba-Kubo-2077";
const meta = { requestId: `prueba-items-${Date.now()}`, ip: null, userAgent: null };
const ESPERA_PREPARACION = 120_000;
// 12/04/2077 cae en el bimestre I (Lima es UTC−5)
const ABRIL = new Date(`${ANIO}-04-12T15:00:00Z`);

type Manejador = (req: NextRequest, contexto: { params: Promise<Record<string, string>> }) => Promise<Response>;

async function pedir(
  manejador: Manejador,
  opciones: { token?: string; params?: Record<string, string>; metodo?: "PUT"; cuerpo?: unknown } = {},
) {
  const req = new NextRequest("http://localhost/api/v1/prueba", {
    method: opciones.metodo ?? "GET",
    headers: opciones.token ? { authorization: `Bearer ${opciones.token}` } : undefined,
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
  });
  const res = await manejador(req, { params: Promise.resolve(opciones.params ?? {}) });
  const json = await res.json();
  return { estado: res.status, datos: json.data, error: json.error as { code: string } | undefined };
}

async function codigoDe(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return {
      codigo: (e as { codigo?: string }).codigo,
      detalles: (e as { detalles?: Record<string, unknown> }).detalles,
    };
  }
  throw new Error("Se esperaba un rechazo");
}

describe.skipIf(!ACTIVA)("ítems de evaluación con pesos (bloque M2)", () => {
  let anioId: string;
  let bimestre: string;
  let planId: string;
  let asignacion: string;
  let docenteAdminId: string;
  let docenteAdminCreado = false;
  let adminPersonaId: string;
  let admin: Autenticado;
  let propio: Autenticado;
  let tokenAjeno = "";
  const competencias: string[] = [];
  const personas: string[] = [];
  const alumnos: Record<"ana" | "bruno", string> = { ana: "", bruno: "" };
  let practica = "";
  let examen = "";

  const califica = (alumno: keyof typeof alumnos, itemId: string, logro: LogroNota) => ({
    itemId,
    matriculaId: alumnos[alumno],
    logro,
  });
  const nota = (alumno: keyof typeof alumnos, competencia: number, logro: LogroNota) => ({
    matriculaId: alumnos[alumno],
    competenciaPlanId: competencias[competencia],
    logro,
  });
  const notaEnBase = (alumno: keyof typeof alumnos, competencia: number) =>
    prisma.nota.findFirst({ where: { matriculaId: alumnos[alumno], competenciaPlanId: competencias[competencia] } });
  const ids = (competencia = 0) => ({
    asignacionId: asignacion,
    periodoId: bimestre,
    competenciaPlanId: competencias[competencia],
  });

  beforeAll(async () => {
    process.env.JWT_SECRET ??= "clave-de-firma-solo-para-pruebas-de-integracion";
    const u = await prisma.usuario.findFirstOrThrow({ where: { email: "admin@kubo.edu.pe" } });
    adminPersonaId = u.personaId;
    admin = {
      usuarioId: u.id,
      sesionId: "prueba",
      personaId: u.personaId,
      email: u.email,
      rol: "ADMINISTRADOR",
      debeCambiarPassword: false,
    };
    const grado = await prisma.grado.findFirstOrThrow({ where: { numero: 1 } });
    anioId = (
      await prisma.anioAcademico.create({
        data: {
          anio: ANIO,
          fechaInicio: new Date(`${ANIO}-03-01T00:00:00Z`),
          fechaFin: new Date(`${ANIO}-12-15T00:00:00Z`),
          estado: "EN_CURSO",
        },
      })
    ).id;
    bimestre = (
      await prisma.periodoEvaluacion.create({
        data: {
          anioAcademicoId: anioId,
          numero: 1,
          nombre: "Bimestre I",
          fechaInicio: new Date(`${ANIO}-03-01T00:00:00Z`),
          fechaFin: new Date(`${ANIO}-05-13T00:00:00Z`),
          estado: "ACTIVO",
        },
      })
    ).id;
    await prisma.reglaConsolidacion.create({
      data: {
        anioAcademicoId: anioId,
        nombre: "Moda de los logros",
        metodo: "MODA",
        criterioDesempate: "MAYOR_JERARQUIA",
        configuracion: {},
        version: 1,
        estado: "VIGENTE",
      },
    });
    for (const [clave, valor] of [
      ["MONTO_MATRICULA", "300.00"],
      ["MONTO_PENSION", "400.00"],
    ] as const) {
      await prisma.parametroInstitucion.create({
        data: { anioAcademicoId: anioId, clave, valor, actualizadoPorId: u.id },
      });
    }
    const seccionId = (
      await prisma.seccion.create({
        data: { anioAcademicoId: anioId, gradoId: grado.id, nombre: "IT", aforoMaximo: 5 },
      })
    ).id;
    const mat = await prisma.curso.findFirstOrThrow({ where: { codigo: "MAT" } });
    const delArea = await prisma.competencia.findMany({
      where: { areaCurricularId: mat.areaCurricularId, activo: true },
      orderBy: { codigo: "asc" },
      take: 2,
    });
    planId = (
      await prisma.planEstudio.create({
        data: { anioAcademicoId: anioId, gradoId: grado.id, cursoId: mat.id, horasSemanales: 4 },
      })
    ).id;
    for (const [i, c] of delArea.entries()) {
      const cp = await prisma.competenciaPlan.create({
        data: { planEstudioId: planId, competenciaId: c.id, orden: i + 1 },
      });
      competencias.push(cp.id);
    }
    const docenteAdmin = await prisma.docente.findUnique({ where: { personaId: u.personaId } });
    docenteAdminId = docenteAdmin?.id ?? (await prisma.docente.create({ data: { personaId: u.personaId } })).id;
    docenteAdminCreado = !docenteAdmin;
    propio = { ...admin, rol: "DOCENTE" };
    asignacion = (
      await prisma.asignacionDocente.create({ data: { planEstudioId: planId, seccionId, docenteId: docenteAdminId } })
    ).id;

    // una docente sin este curso: no ve ni cambia nada de él
    const ajena = await prisma.persona.create({
      data: {
        dni: "90002401",
        nombres: "Elena",
        apellidos: "Ajena Prueba",
        email: "90002401@prueba.kubo.test",
        docente: { create: {} },
      },
    });
    personas.push(ajena.id);
    await prisma.usuario.create({
      data: {
        personaId: ajena.id,
        email: ajena.email!,
        passwordHash: await hashPassword(CLAVE),
        estado: "ACTIVO",
        debeCambiarPassword: false,
      },
    });
    const sesion = await iniciarSesion({ email: ajena.email!, password: CLAVE, recordar: false }, meta);
    if (sesion.tipo !== "SESION") throw new Error("La cuenta de prueba debe tener un solo perfil");
    tokenAjeno = sesion.tokens.acceso;

    const apoderado = await prisma.persona.create({
      data: { dni: "90002411", nombres: "Prueba", apellidos: "Apoderado Ítems", apoderado: { create: {} } },
      include: { apoderado: true },
    });
    personas.push(apoderado.id);
    for (const [clave, dni, nombres, apellidos] of [
      ["ana", "90002421", "Ana", "Álvarez Prueba"],
      ["bruno", "90002422", "Bruno", "Castillo Prueba"],
    ] as const) {
      const es = await prisma.persona.create({
        data: { dni, nombres, apellidos, estudiante: { create: { gradoIngresoId: grado.id } } },
        include: { estudiante: true },
      });
      personas.push(es.id);
      const v = await prisma.vinculoApoderado.create({
        data: {
          estudianteId: es.estudiante!.id,
          apoderadoId: apoderado.apoderado!.id,
          parentesco: "Madre",
          esPrincipal: true,
        },
      });
      const m = await confirmarMatricula(
        admin,
        {
          estudianteId: es.estudiante!.id,
          anioAcademicoId: anioId,
          seccionId,
          vinculoResponsableId: v.id,
          modalidadPago: "MENSUAL",
        },
        meta,
      );
      alumnos[clave] = m.matriculaId;
    }
  }, ESPERA_PREPARACION);

  afterAll(async () => {
    if (!anioId) return;
    // al borrar el cierre se van sus ítems, calificaciones, notas y resultados (los triggers dejan pasar la cascada)
    await prisma.cierreCalificacion.deleteMany({ where: { periodoEvaluacion: { anioAcademicoId: anioId } } });
    await prisma.reglaConsolidacion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.asignacionDocente.deleteMany({ where: { seccion: { anioAcademicoId: anioId } } });
    await prisma.planEstudio.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.matricula.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.vinculoApoderado.deleteMany({ where: { estudiante: { personaId: { in: personas } } } });
    const usuarios = await prisma.usuario.findMany({ where: { personaId: { in: personas } }, select: { id: true } });
    await prisma.sesion.deleteMany({ where: { usuarioId: { in: usuarios.map((x) => x.id) } } });
    await prisma.usuario.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.estudiante.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.apoderado.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.docente.deleteMany({ where: { personaId: { in: personas } } });
    if (docenteAdminCreado) await prisma.docente.deleteMany({ where: { personaId: adminPersonaId } });
    await prisma.persona.deleteMany({ where: { id: { in: personas } } });
    await prisma.seccion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.parametroInstitucion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.anioAcademico.delete({ where: { id: anioId } });
    await prisma.$disconnect();
  }, ESPERA_PREPARACION);

  it("una docente sin el curso no ve ni cambia sus competencias, ítems ni notas (403)", async () => {
    const competenciasAjenas = await pedir(misCompetenciasRuta, { token: tokenAjeno, params: { id: asignacion } });
    const itemsAjenos = await pedir(itemsRuta, {
      token: tokenAjeno,
      params: ids(),
      metodo: "PUT",
      cuerpo: { items: [{ nombre: "Intruso", peso: 100 }] },
    });
    const notasAjenas = await pedir(notasRuta, {
      token: tokenAjeno,
      params: { asignacionId: asignacion, periodoId: bimestre },
      metodo: "PUT",
      cuerpo: { notas: [nota("ana", 1, "AD")] },
    });
    for (const r of [competenciasAjenas, itemsAjenos, notasAjenas]) {
      expect(r.estado).toBe(403);
      expect(r.error?.code).toBe("ACCESO_DENEGADO");
    }
    expect(await prisma.itemEvaluacion.count({ where: { competenciaPlanId: competencias[0] } })).toBe(0);
  });

  it("competencias de mi curso: sin notas en el año el docente puede cambiarlas", async () => {
    const r = await competenciasDeMiCurso(propio, asignacion);
    expect(r).toMatchObject({ editable: true, motivo: null, secciones: ["1° IT"] });
    expect(r.competencias).toHaveLength(2);
    // guarda las mismas con peso: aplica al plan del grado y queda en la auditoría
    const guardadas = await guardarCompetenciasDeMiCurso(
      propio,
      asignacion,
      r.competencias.map((c, i) => ({ competenciaId: c.competencia.id, orden: i + 1, peso: 50 })),
      meta,
    );
    expect(guardadas.competencias.map((c) => c.peso)).toEqual([50, 50]);
    const auditoria = await prisma.registroAuditoria.findFirst({
      where: { requestId: meta.requestId, accion: "GUARDAR_COMPETENCIAS_PLAN", entidadId: planId },
    });
    expect(auditoria?.valorNuevo).toMatchObject({ por: "DOCENTE", asignacionId: asignacion });
  });

  it("crea ítems con pesos 40 y 60: la competencia queda sin nota hasta calificarlos", async () => {
    const r = await guardarItems(
      propio,
      ids(),
      {
        items: [
          { nombre: "Práctica calificada", peso: 40 },
          { nombre: "Examen bimestral", peso: 60 },
        ],
        confirmar: false,
      },
      meta,
      ABRIL,
    );
    const c1 = r.competencias[0];
    expect(c1.items.map((i) => [i.nombre, i.peso, i.orden])).toEqual([
      ["Práctica calificada", 40, 1],
      ["Examen bimestral", 60, 2],
    ]);
    expect(c1).toMatchObject({ sumaPesos: 100, pesosCompletos: true });
    [practica, examen] = c1.items.map((i) => i.id);
    expect(r.alumnos[0].sinNota[competencias[0]]).toMatchObject({ motivo: "ITEMS_PENDIENTES" });
    expect(r.itemsGuardados).toMatchObject({ creados: 2, editados: 0, eliminados: 0 });
  });

  it("calcula la nota con el promedio ponderado en la misma transacción y la deja en la bitácora (ITEMS)", async () => {
    // Ana: AD (40) y B (60) → 2,8 → A · Bruno: solo la práctica → sin nota
    const r = await guardarNotas(
      propio,
      asignacion,
      bimestre,
      {
        notas: [],
        calificaciones: [
          califica("ana", practica, "AD"),
          califica("ana", examen, "B"),
          califica("bruno", practica, "C"),
        ],
      },
      ABRIL,
    );
    expect(r.guardado.calificaciones).toEqual({ nuevas: 3, modificadas: 0 });
    expect(r.guardado.recalculo).toEqual({ calculadas: 1, cambiadas: 0, quitadas: 0 });
    expect((await notaEnBase("ana", 0))?.logro).toBe("A");
    expect(await notaEnBase("bruno", 0)).toBeNull();
    const bruno = r.alumnos.find((a) => a.matriculaId === alumnos.bruno)!;
    expect(bruno.sinNota[competencias[0]].mensaje).toBe("Falta calificar el ítem: Examen bimestral.");
    const bitacora = await prisma.bitacoraNota.findMany({
      where: { matriculaId: alumnos.ana, competenciaPlanId: competencias[0] },
    });
    expect(bitacora.map((b) => [b.origen, b.logroAnterior, b.logroNuevo])).toEqual([["ITEMS", null, "A"]]);

    // cambiar una calificación recalcula: examen AD → (4·40 + 4·60)/100 = 4 → AD
    const otra = await guardarNotas(
      propio,
      asignacion,
      bimestre,
      { notas: [], calificaciones: [califica("ana", examen, "AD")] },
      ABRIL,
    );
    expect(otra.guardado.recalculo).toEqual({ calculadas: 0, cambiadas: 1, quitadas: 0 });
    expect((await notaEnBase("ana", 0))?.logro).toBe("AD");
  });

  it("una competencia con ítems no acepta nota directa; las otras se siguen calificando directo", async () => {
    const e = await codigoDe(guardarNotas(propio, asignacion, bimestre, { notas: [nota("bruno", 0, "A")] }, ABRIL));
    expect(e.codigo).toBe("COMPETENCIA_CON_ITEMS");
    const r = await guardarNotas(
      propio,
      asignacion,
      bimestre,
      { notas: [nota("ana", 1, "A"), nota("bruno", 1, "B")] },
      ABRIL,
    );
    expect(r.guardado).toMatchObject({ nuevas: 2, modificadas: 0 });
  });

  it("los pesos que dejan de sumar 100 quitan la nota solo con confirmación", async () => {
    const cambio = {
      items: [
        { id: practica, nombre: "Práctica calificada", peso: 40 },
        { id: examen, nombre: "Examen bimestral", peso: 50 },
      ],
    };
    const e = await codigoDe(guardarItems(propio, ids(), { ...cambio, confirmar: false }, meta, ABRIL));
    expect(e.codigo).toBe("CONFIRMAR_CAMBIO_ITEMS");
    expect(e.detalles).toMatchObject({ notasQuitadas: 1, calificacionesBorradas: 0 });
    expect((await notaEnBase("ana", 0))?.logro).toBe("AD");

    const r = await guardarItems(propio, ids(), { ...cambio, confirmar: true }, meta, ABRIL);
    expect(r.competencias[0]).toMatchObject({ sumaPesos: 90, pesosCompletos: false });
    expect(await notaEnBase("ana", 0)).toBeNull();
    const ana = r.alumnos.find((a) => a.matriculaId === alumnos.ana)!;
    expect(ana.sinNota[competencias[0]].mensaje).toBe("Los pesos de los ítems suman 90 %; deben sumar 100 %.");
    const quitada = await prisma.bitacoraNota.findFirst({
      where: { matriculaId: alumnos.ana, competenciaPlanId: competencias[0], logroNuevo: null },
    });
    expect(quitada).toMatchObject({ origen: "ITEMS", logroAnterior: "AD" });

    // reordenar y volver a 100: la nota vuelve a calcularse sin pedir confirmación
    const vuelta = await guardarItems(
      propio,
      ids(),
      {
        items: [
          { id: examen, nombre: "Examen bimestral", peso: 60 },
          { id: practica, nombre: "Práctica calificada", peso: 40 },
        ],
        confirmar: false,
      },
      meta,
      ABRIL,
    );
    expect(vuelta.competencias[0].items.map((i) => i.nombre)).toEqual(["Examen bimestral", "Práctica calificada"]);
    expect((await notaEnBase("ana", 0))?.logro).toBe("AD");
  });

  it("eliminar un ítem con calificaciones pide confirmación y recalcula", async () => {
    const soloExamen = { items: [{ id: examen, nombre: "Examen bimestral", peso: 100 }] };
    const e = await codigoDe(guardarItems(propio, ids(), { ...soloExamen, confirmar: false }, meta, ABRIL));
    expect(e.codigo).toBe("CONFIRMAR_CAMBIO_ITEMS");
    expect(e.detalles).toMatchObject({ itemsEliminados: ["Práctica calificada"], calificacionesBorradas: 2 });
    const r = await guardarItems(propio, ids(), { ...soloExamen, confirmar: true }, meta, ABRIL);
    expect(r.itemsGuardados).toMatchObject({ eliminados: 1 });
    expect(await prisma.calificacionItem.count({ where: { itemId: practica } })).toBe(0);
    // Ana solo tiene el examen (AD) con peso 100 → AD; Bruno sigue sin examen → sin nota
    expect((await notaEnBase("ana", 0))?.logro).toBe("AD");
    expect(await notaEnBase("bruno", 0)).toBeNull();
  });

  it("con notas en el año, el docente ya no cambia las competencias de su curso", async () => {
    const r = await competenciasDeMiCurso(propio, asignacion);
    expect(r.editable).toBe(false);
    const e = await codigoDe(
      guardarCompetenciasDeMiCurso(
        propio,
        asignacion,
        r.competencias.map((c, i) => ({ competenciaId: c.competencia.id, orden: i + 1 })),
        meta,
      ),
    );
    expect(e.codigo).toBe("PLAN_CON_NOTAS");
  });

  it("cerrado el registro, los ítems y sus calificaciones no cambian ni por la API ni directo en la base", async () => {
    await guardarNotas(
      propio,
      asignacion,
      bimestre,
      { notas: [], calificaciones: [califica("bruno", examen, "B")] },
      ABRIL,
    );
    const cerrado = await cerrarRegistro(propio, asignacion, bimestre, meta, ABRIL);
    expect(cerrado.estado).toBe("CERRADO");
    const r = await registroDeNotas(propio, asignacion, bimestre, ABRIL);
    expect(r.competencias[0].items).toHaveLength(1);
    expect(r.alumnos.find((a) => a.matriculaId === alumnos.bruno)?.calificaciones[examen]).toBe("B");

    const e = await codigoDe(
      guardarItems(propio, ids(), { items: [{ nombre: "Tarde", peso: 100 }], confirmar: true }, meta, ABRIL),
    );
    expect(e.codigo).toBe("REGISTRO_CERRADO");
    const calificacion = await prisma.calificacionItem.findFirstOrThrow({ where: { itemId: examen } });
    await expect(
      prisma.calificacionItem.update({ where: { id: calificacion.id }, data: { valor: "C" } }),
    ).rejects.toThrow(/REGISTRO_CERRADO/);
    await expect(prisma.calificacionItem.delete({ where: { id: calificacion.id } })).rejects.toThrow(
      /REGISTRO_CERRADO/,
    );
    await expect(prisma.itemEvaluacion.update({ where: { id: examen }, data: { peso: 50 } })).rejects.toThrow(
      /REGISTRO_CERRADO/,
    );
    const cierreId = (await prisma.itemEvaluacion.findUniqueOrThrow({ where: { id: examen } })).cierreId;
    await expect(
      prisma.itemEvaluacion.create({
        data: { cierreId, competenciaPlanId: competencias[0], nombre: "Nuevo", peso: 10, orden: 9 },
      }),
    ).rejects.toThrow(/REGISTRO_CERRADO/);
    await publicarNotas(admin, [cierreId], meta);
  });
});
