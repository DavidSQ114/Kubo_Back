// Prueba de integración del bloque M3: tutoría de sección. Tutor y cotutor (una tutoría por docente y año), guardia
// tutoriaDelDocente (un docente que no es tutor y el tutor de otra sección reciben 403), inicio de la tutoría, registro
// de la asistencia de una clase ajena (la sesión sigue a nombre del docente de la clase y el tutor queda como quien
// registró), modificación con motivo y auditoría sin el plazo de 24 horas, justificación de faltas y tardanzas (las
// justificadas no cuentan para los avisos por umbral) y el reporte de faltas y tardanzas por bimestre.
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/horarios/tutoria.integracion
// Crea sus propios datos ficticios en el año 2076 (en curso, DNI 900025xx) y los borra al terminar. La auditoría es
// inmutable y quien la firma no se puede borrar: el tutor que registra, modifica y justifica es el administrador del
// seed con un perfil Docente temporal. Los casos de uso reciben la fecha («ahora»): la prueba no depende del día.
import "@/server/wiring";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/platform/auth/tokens";
import { prisma } from "@/platform/db/prisma";
import { GET as inicioRuta } from "@/app/api/v1/horarios/tutoria/[seccionId]/inicio/route";
import { POST as justificarRuta } from "@/app/api/v1/horarios/tutoria/[seccionId]/registros/[registroId]/justificar/route";
import { GET as miTutoriaRuta } from "@/app/api/v1/academico/mi-tutoria/route";
import { editarSeccion, misTutorias, tutoriaDelDocente } from "@/modules/academico";
import {
  abrirClaseDeTutoria,
  asignarClase,
  clasesDelDiaDeTutoria,
  corregirAsistenciaDeTutoria,
  esquemasHorarios,
  guardarAsistenciaDeTutoria,
  inicioDeTutoria,
  justificarAsistenciaDeTutoria,
  listarSesiones,
  obtenerCuadricula,
  publicarHorario,
  reporteDeAsistencia,
  reporteDeAsistenciaCsv,
  reporteDeAsistenciaPdf,
} from "@/modules/horarios";
import { iniciarSesion, type Autenticado } from "@/modules/identidad";
import { confirmarMatricula } from "@/modules/matricula";

// los correos de los avisos por umbral no salen de la prueba
vi.mock("@/platform/correo", () => ({
  enviarCorreo: vi.fn(async () => true),
  smtpConfigurado: () => false,
}));

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
const ANIO = 2076;
// contraseña ficticia de las cuentas que crea la prueba (cumple la política; no es de ninguna cuenta real)
const CLAVE = "Prueba-Kubo-2076";
const meta = { requestId: `prueba-tutoria-${Date.now()}`, ip: null, userAgent: null };
const ESPERA_PREPARACION = 120_000;

// Fechas fijas del año ficticio (2076-03-16 es lunes); las horas van en UTC (Lima es UTC−5).
const LUNES = "2076-03-16";
const MIERCOLES_SIGUIENTE = new Date("2076-03-25T15:00:00Z");
const LUNES_SEGUNDO_BIMESTRE = new Date("2076-05-25T15:00:00Z");

type Manejador = (req: NextRequest, contexto: { params: Promise<Record<string, string>> }) => Promise<Response>;

async function pedir(
  manejador: Manejador,
  ruta: string,
  opciones: { token?: string; params?: Record<string, string>; cuerpo?: unknown } = {},
) {
  const req = new NextRequest(`http://localhost/api/v1${ruta}`, {
    method: opciones.cuerpo === undefined ? "GET" : "POST",
    headers: opciones.token ? { authorization: `Bearer ${opciones.token}` } : undefined,
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
  });
  const res = await manejador(req, { params: Promise.resolve(opciones.params ?? {}) });
  const json = await res.json();
  return { estado: res.status, datos: json.data, error: json.error as { code: string; message: string } | undefined };
}

describe.skipIf(!ACTIVA)("tutoría de sección: acceso, asistencia, justificación y reporte (bloque M3)", () => {
  let coordinador: Autenticado;
  /** El administrador del seed con un perfil Docente temporal: tutor de la sección A. */
  let tutor: Autenticado;
  let tutorDocenteId: string;
  let tutorDocenteCreado = false;
  let anioId: string;
  let seccionA: string;
  let seccionB: string;
  const aulas: string[] = [];
  const personas: string[] = [];
  const docenteIds: Record<"salas" | "mora" | "vega", string> = { salas: "", mora: "", vega: "" };
  const token: Record<string, string> = {};
  const alumnos: Record<"diego" | "lucia" | "valeria", string> = { diego: "", lucia: "", valeria: "" };
  let claseA: string;
  let sesionA: string;

  async function ingresar(email: string) {
    const r = await iniciarSesion({ email, password: CLAVE, recordar: false }, meta);
    if (r.tipo !== "SESION") throw new Error("La cuenta de prueba debe tener un solo perfil");
    return r.tokens.acceso;
  }

  beforeAll(async () => {
    process.env.JWT_SECRET ??= "clave-de-firma-solo-para-pruebas-de-integracion";
    const u = await prisma.usuario.findFirstOrThrow({ where: { email: "admin@kubo.edu.pe" } });
    coordinador = {
      usuarioId: u.id,
      sesionId: "prueba",
      personaId: u.personaId,
      email: u.email,
      rol: "COORDINADOR",
      debeCambiarPassword: false,
    };
    tutor = { ...coordinador, rol: "DOCENTE" };
    const propio = await prisma.docente.findUnique({ where: { personaId: u.personaId } });
    tutorDocenteCreado = !propio;
    tutorDocenteId = propio?.id ?? (await prisma.docente.create({ data: { personaId: u.personaId } })).id;

    const passwordHash = await hashPassword(CLAVE);
    const grado = await prisma.grado.findFirstOrThrow({ where: { numero: 2 } });
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
    for (const [numero, nombre, inicio, fin] of [
      [1, "Bimestre I", `${ANIO}-03-02`, `${ANIO}-05-08`],
      [2, "Bimestre II", `${ANIO}-05-18`, `${ANIO}-07-17`],
    ] as const) {
      await prisma.periodoEvaluacion.create({
        data: {
          anioAcademicoId: anioId,
          numero,
          nombre,
          fechaInicio: new Date(`${inicio}T00:00:00Z`),
          fechaFin: new Date(`${fin}T00:00:00Z`),
          estado: "ACTIVO",
        },
      });
    }
    // basta una inasistencia injustificada en el mes para que el alumno tenga aviso
    for (const [clave, valor] of [
      ["MONTO_MATRICULA", "300.00"],
      ["MONTO_PENSION", "400.00"],
      ["UMBRAL_FALTAS_MES", 1],
    ] as const) {
      await prisma.parametroInstitucion.create({
        data: { anioAcademicoId: anioId, clave, valor, actualizadoPorId: u.id },
      });
    }
    const seccion = (nombre: string) =>
      prisma.seccion.create({ data: { anioAcademicoId: anioId, gradoId: grado.id, nombre, aforoMaximo: 5 } });
    seccionA = (await seccion("TA")).id;
    seccionB = (await seccion("TB")).id;
    for (const nombre of ["Aula prueba TU1", "Aula prueba TU2"]) {
      aulas.push((await prisma.aula.create({ data: { nombre, aforo: 30 } })).id);
    }

    // Salas dicta en A sin ser tutor; Mora es tutor de B; Vega será cotutor de A
    for (const [clave, dni, nombres, apellidos] of [
      ["salas", "90002501", "Raúl", "Salas Prueba"],
      ["mora", "90002502", "Inés", "Mora Prueba"],
      ["vega", "90002503", "Elsa", "Vega Prueba"],
    ] as const) {
      const email = `${dni}@prueba.kubo.test`;
      const p = await prisma.persona.create({
        data: { dni, nombres, apellidos, email, docente: { create: {} } },
        include: { docente: true },
      });
      personas.push(p.id);
      await prisma.usuario.create({
        data: { personaId: p.id, email, passwordHash, estado: "ACTIVO", debeCambiarPassword: false },
      });
      docenteIds[clave] = p.docente!.id;
      token[clave] = await ingresar(email);
    }

    const mat = (await prisma.curso.findFirstOrThrow({ where: { codigo: "MAT" } })).id;
    const plan = await prisma.planEstudio.create({
      data: { anioAcademicoId: anioId, gradoId: grado.id, cursoId: mat, horasSemanales: 1 },
    });
    await prisma.asignacionDocente.create({
      data: { planEstudioId: plan.id, seccionId: seccionA, docenteId: docenteIds.salas },
    });
    await prisma.asignacionDocente.create({
      data: { planEstudioId: plan.id, seccionId: seccionB, docenteId: docenteIds.salas },
    });

    const apoderado = await prisma.persona.create({
      data: { dni: "90002511", nombres: "Prueba", apellidos: "Apoderada Tutoría", apoderado: { create: {} } },
      include: { apoderado: true },
    });
    personas.push(apoderado.id);
    for (const [clave, dni, nombres, apellidos, seccionId] of [
      ["diego", "90002521", "Diego", "Quispe Prueba", seccionA],
      ["lucia", "90002522", "Lucía", "Álvarez Prueba", seccionA],
      ["valeria", "90002523", "Valeria", "Rojas Prueba", seccionB],
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
        coordinador,
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
    // las matrículas confirmadas hoy empiezan hoy: se adelantan al inicio del año ficticio
    await prisma.matricula.updateMany({
      where: { anioAcademicoId: anioId },
      data: { fechaMatricula: new Date(`${ANIO}-03-01T00:00:00Z`) },
    });
    await prisma.historialSeccion.updateMany({
      where: { matricula: { anioAcademicoId: anioId } },
      data: { fechaInicio: new Date(`${ANIO}-03-01T00:00:00Z`) },
    });

    // Matemática el lunes a primera hora en las dos secciones, con Salas
    const bloque = (await obtenerCuadricula(seccionA)).bloques.find((b) => b.tipo === "CLASE")!.id;
    const celda = { dia: "LUNES" as const, bloqueId: bloque };
    await asignarClase(
      coordinador,
      seccionA,
      celda,
      { cursoId: mat, docenteId: docenteIds.salas, aulaId: aulas[0] },
      meta,
    );
    await publicarHorario(coordinador, seccionA, meta);
    const otroBloque = (await obtenerCuadricula(seccionB)).bloques.filter((b) => b.tipo === "CLASE")[1].id;
    await asignarClase(
      coordinador,
      seccionB,
      { dia: "LUNES", bloqueId: otroBloque },
      { cursoId: mat, docenteId: docenteIds.salas, aulaId: aulas[1] },
      meta,
    );
    await publicarHorario(coordinador, seccionB, meta);
  }, ESPERA_PREPARACION);

  afterAll(async () => {
    if (!anioId) return;
    await prisma.sesionClase.deleteMany({ where: { detalleHorario: { seccion: { anioAcademicoId: anioId } } } });
    await prisma.horario.deleteMany({ where: { seccion: { anioAcademicoId: anioId } } });
    await prisma.bloqueHorario.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.asignacionDocente.deleteMany({ where: { seccion: { anioAcademicoId: anioId } } });
    await prisma.planEstudio.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.matricula.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.vinculoApoderado.deleteMany({ where: { estudiante: { personaId: { in: personas } } } });
    const usuarios = await prisma.usuario.findMany({ where: { personaId: { in: personas } }, select: { id: true } });
    await prisma.sesion.deleteMany({ where: { usuarioId: { in: usuarios.map((x) => x.id) } } });
    await prisma.usuario.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.seccion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.estudiante.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.apoderado.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.docente.deleteMany({ where: { personaId: { in: personas } } });
    if (tutorDocenteCreado) await prisma.docente.deleteMany({ where: { id: tutorDocenteId } });
    await prisma.persona.deleteMany({ where: { id: { in: personas } } });
    await prisma.aula.deleteMany({ where: { id: { in: aulas } } });
    await prisma.parametroInstitucion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.periodoEvaluacion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.anioAcademico.delete({ where: { id: anioId } });
    await prisma.$disconnect();
  }, ESPERA_PREPARACION);

  // ---------- Fase 1 · Tutor y cotutor ----------

  it("el coordinador asigna tutor y cotutor; un docente tiene una sola tutoría por año", async () => {
    await editarSeccion(coordinador, seccionA, { tutorId: tutorDocenteId, cotutorId: docenteIds.vega }, meta);
    await editarSeccion(coordinador, seccionB, { tutorId: docenteIds.mora }, meta);
    // el tutor y el cotutor no pueden ser el mismo docente
    await expect(editarSeccion(coordinador, seccionB, { cotutorId: docenteIds.mora }, meta)).rejects.toMatchObject({
      codigo: "TUTOR_IGUAL_COTUTOR",
    });
    // el cotutor de A no puede ser cotutor de B
    await expect(editarSeccion(coordinador, seccionB, { cotutorId: docenteIds.vega }, meta)).rejects.toMatchObject({
      codigo: "DOCENTE_YA_ES_TUTOR",
    });
    // el trigger también lo impide si se salta la aplicación
    await expect(
      prisma.seccion.update({ where: { id: seccionB }, data: { cotutorId: tutorDocenteId } }),
    ).rejects.toThrow(/DOCENTE_YA_ES_TUTOR/);
    const auditoria = await prisma.registroAuditoria.findFirst({
      where: { accion: "EDITAR_SECCION", requestId: meta.requestId, entidadId: seccionA },
    });
    expect(auditoria?.valorNuevo).toMatchObject({ tutorId: tutorDocenteId, cotutorId: docenteIds.vega });
  });

  // ---------- Fase 2 · Acceso ----------

  it("el tutor y el cotutor ven su tutoría; los demás docentes no", async () => {
    expect((await misTutorias(tutor)).map((t) => [t.seccion.id, t.rol])).toEqual([[seccionA, "TUTOR"]]);
    const cotutor = await pedir(miTutoriaRuta, "/academico/mi-tutoria", { token: token.vega });
    expect(cotutor.datos.tutorias).toMatchObject([{ rol: "COTUTOR", seccion: { id: seccionA } }]);
    const salas = await pedir(miTutoriaRuta, "/academico/mi-tutoria", { token: token.salas });
    expect(salas).toMatchObject({ estado: 200, datos: { tutorias: [] } });
    await expect(tutoriaDelDocente(tutor, seccionB)).rejects.toMatchObject({ codigo: "NO_ES_TUTOR" });
  });

  it("un docente que no es tutor y el tutor de otra sección reciben 403", async () => {
    const ruta = `/horarios/tutoria/${seccionA}/inicio`;
    const params = { seccionId: seccionA };
    expect(await pedir(inicioRuta, ruta, { token: token.salas, params })).toMatchObject({
      estado: 403,
      error: { code: "NO_ES_TUTOR" },
    });
    expect(await pedir(inicioRuta, ruta, { token: token.mora, params })).toMatchObject({
      estado: 403,
      error: { code: "NO_ES_TUTOR" },
    });
    expect(await pedir(inicioRuta, ruta, { params })).toMatchObject({ estado: 401 });
    // el cotutor tiene los mismos permisos que el tutor
    expect(await pedir(inicioRuta, ruta, { token: token.vega, params })).toMatchObject({
      estado: 200,
      datos: { rol: "COTUTOR", seccion: { id: seccionA } },
    });
  });

  // ---------- Fase 3 · Asistencia ----------

  it("el tutor registra la clase de otro docente: la sesión sigue a su nombre y el tutor queda como quien registró", async () => {
    const dia = await clasesDelDiaDeTutoria(tutor, seccionA, { fecha: LUNES }, MIERCOLES_SIGUIENTE);
    expect(dia.clases).toHaveLength(1);
    expect(dia.clases[0]).toMatchObject({ docente: { id: docenteIds.salas }, sesion: null });
    claseA = dia.clases[0].claseId;

    const sesion = await abrirClaseDeTutoria(tutor, seccionA, { claseId: claseA, fecha: LUNES }, MIERCOLES_SIGUIENTE);
    sesionA = sesion.id;
    expect(sesion).toMatchObject({ editable: true, docente: { id: docenteIds.salas } });
    const lista = esquemasHorarios.ListaAsistenciaTutoriaSchema.parse({
      alumnos: [
        { matriculaId: alumnos.diego, estado: "FALTA" },
        { matriculaId: alumnos.lucia, estado: "TARDANZA" },
      ],
    });
    // nueve días después de la clase: el plazo de 24 horas del docente no aplica al tutor
    await guardarAsistenciaDeTutoria(tutor, seccionA, sesionA, lista, meta, MIERCOLES_SIGUIENTE);
    const fila = await prisma.sesionClase.findUniqueOrThrow({
      where: { id: sesionA },
      include: { asistenciasEstudiante: true },
    });
    expect(fila.docenteId).toBe(docenteIds.salas);
    expect(fila.asistenciasEstudiante.every((r) => r.registradoPorId === tutor.usuarioId)).toBe(true);
    // el docente de la clase ve la sesión como suya
    const personaSalas = await prisma.docente.findUniqueOrThrow({ where: { id: docenteIds.salas } });
    const deSalas = { ...tutor, personaId: personaSalas.personaId };
    const suyas = await listarSesiones(deSalas, { fecha: LUNES }, MIERCOLES_SIGUIENTE);
    expect(suyas.sesiones.map((s) => s.id)).toContain(sesionA);
    const registro = await prisma.registroAuditoria.findFirst({
      where: { accion: "REGISTRAR_ASISTENCIA_TUTORIA", requestId: meta.requestId, entidadId: sesionA },
    });
    expect(registro?.valorNuevo).toMatchObject({ registros: 2, docenteDeLaClaseId: docenteIds.salas });
  });

  it("modificar lo guardado exige motivo y queda en la auditoría", async () => {
    const cambio = esquemasHorarios.ListaAsistenciaTutoriaSchema.parse({
      alumnos: [
        { matriculaId: alumnos.diego, estado: "FALTA" },
        { matriculaId: alumnos.lucia, estado: "PRESENTE" },
      ],
    });
    await expect(
      guardarAsistenciaDeTutoria(tutor, seccionA, sesionA, cambio, meta, MIERCOLES_SIGUIENTE),
    ).rejects.toMatchObject({ codigo: "MOTIVO_REQUERIDO" });

    const lucia = await prisma.asistenciaEstudiante.findFirstOrThrow({
      where: { sesionClaseId: sesionA, matriculaId: alumnos.lucia },
    });
    await corregirAsistenciaDeTutoria(
      tutor,
      seccionA,
      lucia.id,
      { estado: "PRESENTE", motivo: "Llegó a tiempo; se registró mal" },
      meta,
      MIERCOLES_SIGUIENTE,
    );
    const corregido = await prisma.asistenciaEstudiante.findUniqueOrThrow({ where: { id: lucia.id } });
    expect(corregido).toMatchObject({
      estado: "PRESENTE",
      estadoAnterior: "TARDANZA",
      modificadoPorId: tutor.usuarioId,
    });
    const auditoria = await prisma.registroAuditoria.findFirst({
      where: { accion: "CORREGIR_ASISTENCIA", requestId: meta.requestId, entidadId: lucia.id },
    });
    expect(auditoria).toMatchObject({ motivo: "Llegó a tiempo; se registró mal", valorNuevo: { por: "TUTOR" } });
    // vuelve a tardanza para justificarla después
    await corregirAsistenciaDeTutoria(
      tutor,
      seccionA,
      lucia.id,
      { estado: "TARDANZA", motivo: "Sí llegó tarde: lo confirmó el docente" },
      meta,
      MIERCOLES_SIGUIENTE,
    );
  });

  it("fuera del bimestre en curso no se registra ni se modifica", async () => {
    await expect(
      clasesDelDiaDeTutoria(tutor, seccionA, { fecha: LUNES }, LUNES_SEGUNDO_BIMESTRE),
    ).rejects.toMatchObject({ codigo: "FUERA_DEL_BIMESTRE_EN_CURSO" });
    const diego = await prisma.asistenciaEstudiante.findFirstOrThrow({
      where: { sesionClaseId: sesionA, matriculaId: alumnos.diego },
    });
    await expect(
      justificarAsistenciaDeTutoria(
        tutor,
        seccionA,
        diego.id,
        { motivo: "Constancia médica" },
        meta,
        LUNES_SEGUNDO_BIMESTRE,
      ),
    ).rejects.toMatchObject({ codigo: "FUERA_DEL_BIMESTRE_EN_CURSO" });
  });

  it("las faltas justificadas no cuentan para el aviso por umbral", async () => {
    const antes = await inicioDeTutoria(tutor, seccionA, MIERCOLES_SIGUIENTE);
    expect(antes.alumnosConAviso.map((a) => a.matriculaId)).toEqual([alumnos.diego]);

    const diego = await prisma.asistenciaEstudiante.findFirstOrThrow({
      where: { sesionClaseId: sesionA, matriculaId: alumnos.diego },
    });
    // el tutor de otra sección no puede justificar (403 de la guardia)
    const ajeno = await pedir(justificarRuta, `/horarios/tutoria/${seccionA}/registros/${diego.id}/justificar`, {
      token: token.mora,
      params: { seccionId: seccionA, registroId: diego.id },
      cuerpo: { motivo: "Constancia médica" },
    });
    expect(ajeno).toMatchObject({ estado: 403, error: { code: "NO_ES_TUTOR" } });

    const r = await justificarAsistenciaDeTutoria(
      tutor,
      seccionA,
      diego.id,
      { motivo: "Constancia de cita médica" },
      meta,
      MIERCOLES_SIGUIENTE,
    );
    expect(r.estado).toBe("FALTA_JUSTIFICADA");
    const lucia = await prisma.asistenciaEstudiante.findFirstOrThrow({
      where: { sesionClaseId: sesionA, matriculaId: alumnos.lucia },
    });
    const t = await justificarAsistenciaDeTutoria(
      tutor,
      seccionA,
      lucia.id,
      { motivo: "Movilidad escolar retrasada" },
      meta,
      MIERCOLES_SIGUIENTE,
    );
    expect(t.estado).toBe("TARDANZA_JUSTIFICADA");
    await expect(
      justificarAsistenciaDeTutoria(tutor, seccionA, lucia.id, { motivo: "Otra vez" }, meta, MIERCOLES_SIGUIENTE),
    ).rejects.toMatchObject({ codigo: "YA_JUSTIFICADO" });

    const despues = await inicioDeTutoria(tutor, seccionA, MIERCOLES_SIGUIENTE);
    expect(despues.alumnosConAviso).toEqual([]);
    const auditoria = await prisma.registroAuditoria.findMany({
      where: { accion: "JUSTIFICAR_ASISTENCIA", requestId: meta.requestId },
    });
    expect(auditoria).toHaveLength(2);
  });

  it("un registro de otra sección no se toca desde la tutoría", async () => {
    // la sesión de B la abre el docente de la clase; el tutor de A no puede justificarla
    const claseB = await prisma.detalleHorario.findFirstOrThrow({
      where: { seccionId: seccionB, horario: { estadoPublicacion: "PUBLICADO" } },
    });
    const sesionB = await prisma.sesionClase.create({
      data: { detalleHorarioId: claseB.id, docenteId: docenteIds.salas, fecha: new Date(`${LUNES}T00:00:00Z`) },
    });
    const registro = await prisma.asistenciaEstudiante.create({
      data: {
        sesionClaseId: sesionB.id,
        matriculaId: alumnos.valeria,
        estado: "FALTA",
        registradoPorId: tutor.usuarioId,
      },
    });
    await expect(
      justificarAsistenciaDeTutoria(
        tutor,
        seccionA,
        registro.id,
        { motivo: "Constancia médica" },
        meta,
        MIERCOLES_SIGUIENTE,
      ),
    ).rejects.toMatchObject({ codigo: "REGISTRO_DE_OTRA_SECCION" });
    // y la clase de B no se abre desde la tutoría de A
    await expect(
      abrirClaseDeTutoria(tutor, seccionA, { claseId: claseB.id, fecha: LUNES }, MIERCOLES_SIGUIENTE),
    ).rejects.toMatchObject({ codigo: "CLASE_DE_OTRA_SECCION" });
  });

  // ---------- Fase 4 · Reporte de faltas y tardanzas ----------

  it("el reporte por bimestre cuenta cada estado, ordena y suma los totales; CSV y PDF", async () => {
    const r = await reporteDeAsistencia(tutor, seccionA, {}, MIERCOLES_SIGUIENTE);
    expect(r.bimestre.nombre).toBe("Bimestre I");
    expect(r.orden).toBe("faltas");
    const porAlumno = Object.fromEntries(r.filas.map((f) => [f.matriculaId, f]));
    expect(porAlumno[alumnos.diego]).toMatchObject({
      clases: 1,
      faltas: 0,
      faltasJustificadas: 1,
      porcentajeAsistencia: 0,
    });
    expect(porAlumno[alumnos.lucia]).toMatchObject({ clases: 1, tardanzasJustificadas: 1, porcentajeAsistencia: 100 });
    expect(r.total).toMatchObject({
      clases: 2,
      faltasJustificadas: 1,
      tardanzasJustificadas: 1,
      porcentajeAsistencia: 50,
    });
    // ordenado por % de asistencia ascendente: primero quien menos asiste
    const asc = await reporteDeAsistencia(
      tutor,
      seccionA,
      { orden: "porcentajeAsistencia", ascendente: true },
      MIERCOLES_SIGUIENTE,
    );
    expect(asc.filas.map((f) => f.matriculaId)).toEqual([alumnos.diego, alumnos.lucia]);

    const csv = await reporteDeAsistenciaCsv(tutor, seccionA, { periodoId: r.bimestre.id });
    expect(csv.nombreArchivo).toBe("Asistencia_2TA_BimestreI_2076.csv");
    expect(csv.texto.startsWith("\uFEFFAño,Bimestre,Sección,Estudiante,Clases")).toBe(true);
    expect(csv.texto).toContain("Total de la sección");
    const pdf = await reporteDeAsistenciaPdf(tutor, seccionA, { periodoId: r.bimestre.id });
    expect(Buffer.from(pdf.bytes).subarray(0, 4).toString()).toBe("%PDF");
    // otro docente no descarga el reporte
    await expect(reporteDeAsistencia(tutor, seccionB, {})).rejects.toMatchObject({ codigo: "NO_ES_TUTOR" });
  });
});
