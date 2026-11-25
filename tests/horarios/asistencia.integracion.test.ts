// Prueba de integración (US35, US36, US45, US52): asistencia de alumnos. Toma de asistencia del docente, plazo de
// corrección, corrección del administrador con auditoría, aviso único por umbral y la seguridad de cada endpoint:
// 401 sin sesión, 403 con otro perfil, un docente no ve sesiones ajenas, un apoderado solo a sus hijos y un alumno
// solo lo suyo.
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/horarios/asistencia.integracion
// Crea sus propios datos ficticios en el año 2089 (en curso, con un bimestre) y los borra al terminar. Los casos de
// uso reciben la fecha («ahora») como parámetro: la prueba no depende del día en que se ejecuta.
import "@/server/wiring";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/platform/auth/tokens";
import { enviarCorreo } from "@/platform/correo";
import { prisma } from "@/platform/db/prisma";
import { GET as asistenciaAlumno } from "@/app/api/v1/horarios/alumno/asistencia/route";
import { GET as asistenciaHijo } from "@/app/api/v1/horarios/apoderado/hijos/[id]/asistencia/route";
import { GET as clasesHoy } from "@/app/api/v1/horarios/asistencia/clases-de-hoy/route";
import { POST as corregir } from "@/app/api/v1/horarios/asistencia/registros/[id]/corregir/route";
import { PUT as guardarLista } from "@/app/api/v1/horarios/asistencia/sesiones/[id]/registros/route";
import { GET as verSesion } from "@/app/api/v1/horarios/asistencia/sesiones/[id]/route";
import { GET as listarSesionesRuta, POST as abrir } from "@/app/api/v1/horarios/asistencia/sesiones/route";
import {
  abrirSesion,
  asignarClase,
  asistenciaDelAlumno,
  asistenciaDelHijo,
  clasesDeHoy,
  corregirAsistencia,
  detalleDeSesion,
  esquemasHorarios,
  guardarAsistencia,
  listarSesiones,
  obtenerCuadricula,
  publicarHorario,
} from "@/modules/horarios";
import { iniciarSesion, type Autenticado } from "@/modules/identidad";
import { anularMatricula, confirmarMatricula } from "@/modules/matricula";

// los correos no salen de la prueba: se revisa cuáles se pidieron
vi.mock("@/platform/correo", () => ({
  enviarCorreo: vi.fn(async () => true),
  smtpConfigurado: () => false,
}));

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
const ANIO = 2089;
// contraseña ficticia de las cuentas que crea la prueba (cumple la política; no es de ninguna cuenta real)
const CLAVE = "Prueba-Kubo-2089";
// la bitácora es inmutable y conserva las filas de corridas anteriores: cada corrida usa su propio requestId
const meta = { requestId: `prueba-asistencia-${Date.now()}`, ip: null, userAgent: null };
const ESPERA_PREPARACION = 120_000;
const UUID_INEXISTENTE = "00000000-0000-4000-8000-000000000000";

// Fechas fijas del año ficticio. El 14/03/2089 es lunes; las horas van en UTC (Lima es UTC−5).
const LUNES = "2089-03-14";
const LUNES_10H = new Date("2089-03-14T15:00:00Z");
const LUNES_12H = new Date("2089-03-14T17:00:00Z");
const MARTES_9H = new Date("2089-03-15T14:00:00Z");
const MARTES_11H = new Date("2089-03-15T16:00:00Z");
const SABADO_10H = new Date("2089-03-19T15:00:00Z");
const SIGUIENTE_LUNES_10H = new Date("2089-03-21T15:00:00Z");

type Manejador = (req: NextRequest, contexto: { params: Promise<Record<string, string>> }) => Promise<Response>;

/** Llama a un Route Handler como lo haría el navegador: con el token de acceso (o sin él) y sus params. */
async function pedir(
  manejador: Manejador,
  ruta: string,
  opciones: { token?: string; params?: Record<string, string>; metodo?: "POST" | "PUT"; cuerpo?: unknown } = {},
) {
  const req = new NextRequest(`http://localhost/api/v1${ruta}`, {
    method: opciones.metodo ?? "GET",
    headers: opciones.token ? { authorization: `Bearer ${opciones.token}` } : undefined,
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
  });
  const res = await manejador(req, { params: Promise.resolve(opciones.params ?? {}) });
  const json = await res.json();
  return { estado: res.status, datos: json.data, error: json.error as { code: string; message: string } | undefined };
}

describe.skipIf(!ACTIVA)(
  "asistencia de alumnos: registro, plazo, corrección y permisos (US35, US36, US45, US52)",
  () => {
    let admin: Autenticado;
    let anioId: string;
    let seccionA: string;
    let seccionB: string;
    const aulas: string[] = [];
    const personas: string[] = [];
    const docentes: Record<"rivera" | "salas", Autenticado> = { rivera: {} as Autenticado, salas: {} as Autenticado };
    // Diego (con cuenta de alumno) y Lucía están en la sección A; Valeria, en la B; la matrícula de Bruno se anula
    const alumnos: Record<"diego" | "lucia" | "valeria" | "bruno", { estudianteId: string; matriculaId: string }> = {
      diego: { estudianteId: "", matriculaId: "" },
      lucia: { estudianteId: "", matriculaId: "" },
      valeria: { estudianteId: "", matriculaId: "" },
      bruno: { estudianteId: "", matriculaId: "" },
    };
    const emailDiego = "diego.2089@prueba.kubo.test";
    const emailApoderadoA = "90001011@prueba.kubo.test";
    let alumnoDiego: Autenticado;
    let apoderadoA: Autenticado;
    const token: Record<string, string> = {};
    /** Sesiones de clase del lunes: la de Rivera (sección A) y la de Salas (sección B). */
    let sesionRivera: string;
    let sesionSalas: string;
    let claseRivera: string;
    const correo = vi.mocked(enviarCorreo);

    /** Lista de asistencia como llega a la API: pasa por el mismo esquema Zod que el endpoint. */
    const marcas = (estados: Partial<Record<keyof typeof alumnos, [string | null, string?]>>) =>
      esquemasHorarios.ListaAsistenciaSchema.parse({
        alumnos: Object.entries(estados).map(([clave, [estado, observacion]]) => ({
          matriculaId: alumnos[clave as keyof typeof alumnos].matriculaId,
          estado,
          observacion: observacion ?? null,
        })),
      });

    /** Inicia sesión como lo hace el login y devuelve el token de acceso. */
    async function ingresar(email: string) {
      const r = await iniciarSesion({ email, password: CLAVE, recordar: false }, meta);
      if (r.tipo !== "SESION") throw new Error("La cuenta de prueba debe tener un solo perfil");
      return r.tokens.acceso;
    }

    beforeAll(async () => {
      // clave de firma solo para la prueba, por si el entorno no define una (el CI no la necesita para nada más)
      process.env.JWT_SECRET ??= "clave-de-firma-solo-para-pruebas-de-integracion";
      const u = await prisma.usuario.findFirstOrThrow({ where: { email: "admin@kubo.edu.pe" } });
      admin = {
        usuarioId: u.id,
        sesionId: "prueba",
        personaId: u.personaId,
        email: u.email,
        // bloque M1: la vista de todas las sesiones y la corrección son del coordinador académico
        rol: "COORDINADOR",
        debeCambiarPassword: false,
      };
      const passwordHash = await hashPassword(CLAVE);
      const cuenta = async (personaId: string, email: string, rol: Autenticado["rol"]): Promise<Autenticado> => {
        const usuario = await prisma.usuario.create({
          data: { personaId, email, passwordHash, estado: "ACTIVO", debeCambiarPassword: false },
        });
        return { usuarioId: usuario.id, sesionId: "prueba", personaId, email, rol, debeCambiarPassword: false };
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
      await prisma.periodoEvaluacion.create({
        data: {
          anioAcademicoId: anioId,
          numero: 1,
          nombre: "Bimestre I",
          fechaInicio: new Date(`${ANIO}-03-01T00:00:00Z`),
          fechaFin: new Date(`${ANIO}-05-13T00:00:00Z`),
          estado: "ACTIVO",
        },
      });
      // en este año basta una inasistencia injustificada en el mes para activar la alerta y el aviso (US45, US52)
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
      seccionA = (await seccion("AA")).id;
      seccionB = (await seccion("AB")).id;
      for (const nombre of ["Aula prueba AS1", "Aula prueba AS2"]) {
        aulas.push((await prisma.aula.create({ data: { nombre, aforo: 30 } })).id);
      }
      const mat = (await prisma.curso.findFirstOrThrow({ where: { codigo: "MAT" } })).id;

      // dos docentes con cuenta: Rivera dicta Matemática en la sección A y Salas, en la B
      const docenteIds: Record<string, string> = {};
      for (const [clave, dni, nombres, apellidos] of [
        ["rivera", "90001001", "Karen", "Rivera Prueba"],
        ["salas", "90001002", "Raúl", "Salas Prueba"],
      ] as const) {
        const email = `${dni}@prueba.kubo.test`;
        const p = await prisma.persona.create({
          data: { dni, nombres, apellidos, email, docente: { create: {} } },
          include: { docente: true },
        });
        personas.push(p.id);
        docentes[clave] = await cuenta(p.id, email, "DOCENTE");
        docenteIds[clave] = p.docente!.id;
      }
      const plan = await prisma.planEstudio.create({
        data: { anioAcademicoId: anioId, gradoId: grado.id, cursoId: mat, horasSemanales: 1 },
      });
      await prisma.asignacionDocente.create({
        data: { planEstudioId: plan.id, seccionId: seccionA, docenteId: docenteIds.rivera },
      });
      await prisma.asignacionDocente.create({
        data: { planEstudioId: plan.id, seccionId: seccionB, docenteId: docenteIds.salas },
      });

      // dos familias: la primera con tres hijos en la sección A y la segunda con una hija en la B
      const apoderado = async (dni: string, n: number) => {
        const email = `${dni}@prueba.kubo.test`;
        const p = await prisma.persona.create({
          data: { dni, nombres: "Prueba", apellidos: `Apoderado ${n}`, email, apoderado: { create: {} } },
          include: { apoderado: true },
        });
        personas.push(p.id);
        return { apoderadoId: p.apoderado!.id, auth: await cuenta(p.id, email, "APODERADO"), email };
      };
      const familiaA = await apoderado("90001011", 1);
      const familiaB = await apoderado("90001012", 2);
      apoderadoA = familiaA.auth;
      for (const [clave, dni, nombres, apellidos, familia, seccionId] of [
        ["diego", "90001021", "Diego", "Quispe Prueba", familiaA, seccionA],
        ["lucia", "90001022", "Lucía", "Álvarez Prueba", familiaA, seccionA],
        ["bruno", "90001023", "Bruno", "Zavala Prueba", familiaA, seccionA],
        ["valeria", "90001024", "Valeria", "Rojas Prueba", familiaB, seccionB],
      ] as const) {
        const es = await prisma.persona.create({
          data: { dni, nombres, apellidos, estudiante: { create: { gradoIngresoId: grado.id } } },
          include: { estudiante: true },
        });
        personas.push(es.id);
        const v = await prisma.vinculoApoderado.create({
          data: {
            estudianteId: es.estudiante!.id,
            apoderadoId: familia.apoderadoId,
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
        alumnos[clave] = { estudianteId: es.estudiante!.id, matriculaId: m.matriculaId };
        if (clave === "diego") {
          await prisma.persona.update({ where: { id: es.id }, data: { email: emailDiego } });
          alumnoDiego = await cuenta(es.id, emailDiego, "ALUMNO");
        }
      }
      // una matrícula anulada no aparece en la lista de la clase
      await anularMatricula(
        admin,
        alumnos.bruno.matriculaId,
        { motivo: "ERROR_DIGITACION", detalle: "Prueba de integración" },
        meta,
      );

      // horarios publicados: las dos secciones tienen Matemática el lunes a primera hora, cada una con su docente
      const bloque = (await obtenerCuadricula(seccionA)).bloques.find((b) => b.tipo === "CLASE")!.id;
      const celda = { dia: "LUNES" as const, bloqueId: bloque };
      await asignarClase(
        admin,
        seccionA,
        celda,
        { cursoId: mat, docenteId: docenteIds.rivera, aulaId: aulas[0] },
        meta,
      );
      await asignarClase(admin, seccionB, celda, { cursoId: mat, docenteId: docenteIds.salas, aulaId: aulas[1] }, meta);
      await publicarHorario(admin, seccionA, meta);
      await publicarHorario(admin, seccionB, meta);

      for (const [clave, email] of [
        ["rivera", docentes.rivera.email],
        ["salas", docentes.salas.email],
        ["apoderadoA", familiaA.email],
        ["apoderadoB", familiaB.email],
        ["diego", emailDiego],
      ] as const) {
        token[clave] = await ingresar(email);
      }
      correo.mockClear();
    }, ESPERA_PREPARACION);

    afterAll(async () => {
      if (!anioId) return;
      // al borrar la sesión de clase se van sus registros de asistencia; los avisos se van con la matrícula
      await prisma.sesionClase.deleteMany({ where: { detalleHorario: { seccion: { anioAcademicoId: anioId } } } });
      await prisma.horario.deleteMany({ where: { seccion: { anioAcademicoId: anioId } } });
      await prisma.bloqueHorario.deleteMany({ where: { anioAcademicoId: anioId } });
      await prisma.asignacionDocente.deleteMany({ where: { seccion: { anioAcademicoId: anioId } } });
      await prisma.planEstudio.deleteMany({ where: { anioAcademicoId: anioId } });
      await prisma.matricula.deleteMany({ where: { anioAcademicoId: anioId } });
      await prisma.vinculoApoderado.deleteMany({ where: { estudiante: { personaId: { in: personas } } } });
      await prisma.usuario.deleteMany({ where: { personaId: { in: personas } } });
      await prisma.estudiante.deleteMany({ where: { personaId: { in: personas } } });
      await prisma.apoderado.deleteMany({ where: { personaId: { in: personas } } });
      await prisma.docente.deleteMany({ where: { personaId: { in: personas } } });
      await prisma.persona.deleteMany({ where: { id: { in: personas } } });
      await prisma.seccion.deleteMany({ where: { anioAcademicoId: anioId } });
      await prisma.aula.deleteMany({ where: { id: { in: aulas } } });
      await prisma.parametroInstitucion.deleteMany({ where: { anioAcademicoId: anioId } });
      await prisma.anioAcademico.delete({ where: { id: anioId } });
      await prisma.$disconnect();
    }, ESPERA_PREPARACION);

    // ---------- US35 · Clases de hoy y toma de asistencia ----------

    it("el docente ve sus clases de hoy según el horario publicado y un mensaje claro cuando no tiene", async () => {
      const lunes = await clasesDeHoy(docentes.rivera, LUNES_10H);
      expect(lunes).toMatchObject({ fecha: LUNES, dia: "LUNES", sinClases: null });
      expect(lunes.clases).toHaveLength(1);
      expect(lunes.clases[0]).toMatchObject({ curso: { codigo: "MAT" }, seccion: { id: seccionA }, sesion: null });
      claseRivera = lunes.clases[0].claseId;

      expect(await clasesDeHoy(docentes.rivera, MARTES_9H)).toMatchObject({
        clases: [],
        sinClases: { motivo: "SIN_CLASES", mensaje: "No tienes clases programadas para hoy en el horario publicado." },
      });
      expect(await clasesDeHoy(docentes.rivera, SABADO_10H)).toMatchObject({
        dia: null,
        clases: [],
        sinClases: { motivo: "FIN_DE_SEMANA", mensaje: "Hoy no hay clases: es fin de semana." },
      });
      // fuera del bimestre (el año termina en diciembre, pero el único bimestre acaba en mayo)
      expect(await clasesDeHoy(docentes.rivera, new Date("2089-06-06T15:00:00Z"))).toMatchObject({
        sinClases: { motivo: "FUERA_DE_BIMESTRE" },
      });
    });

    it("al elegir la clase se crea la sesión y lista a los matriculados de la sección, sin la matrícula anulada", async () => {
      const sesion = await abrirSesion(docentes.rivera, { claseId: claseRivera }, LUNES_10H);
      sesionRivera = sesion.id;
      expect(sesion).toMatchObject({ fecha: LUNES, registrada: false, editable: true, bimestre: "Bimestre I" });
      expect(sesion.alumnos.map((a) => a.nombre)).toEqual(["Álvarez Prueba, Lucía", "Quispe Prueba, Diego"]);
      expect(sesion.alumnos.every((a) => a.estado === null && a.dni === null)).toBe(true);
      expect(sesion.resumen).toMatchObject({ sinMarcar: 2, presentes: 0 });

      // volver a elegirla no crea otra sesión
      expect((await abrirSesion(docentes.rivera, { claseId: claseRivera }, LUNES_12H)).id).toBe(sesionRivera);
      expect(await prisma.sesionClase.count({ where: { detalleHorarioId: claseRivera } })).toBe(1);

      const delOtro = await clasesDeHoy(docentes.salas, LUNES_10H);
      sesionSalas = (await abrirSesion(docentes.salas, { claseId: delOtro.clases[0].claseId }, LUNES_10H)).id;
    });

    it("no abre una clase ajena, una fecha futura, un día pasado ni un día en que la clase no está programada", async () => {
      await expect(abrirSesion(docentes.salas, { claseId: claseRivera }, LUNES_10H)).rejects.toMatchObject({
        codigo: "CLASE_AJENA",
        estadoHttp: 403,
      });
      await expect(
        abrirSesion(docentes.rivera, { claseId: claseRivera, fecha: "2089-03-21" }, LUNES_10H),
      ).rejects.toMatchObject({
        codigo: "FECHA_FUTURA",
        estadoHttp: 422,
        message: "No se puede registrar la asistencia de una fecha futura.",
      });
      await expect(
        abrirSesion(docentes.rivera, { claseId: claseRivera, fecha: LUNES }, MARTES_9H),
      ).rejects.toMatchObject({ codigo: "SOLO_DIA_ACTUAL", estadoHttp: 422 });
      // el martes la clase del lunes no está en el horario
      await expect(abrirSesion(docentes.rivera, { claseId: claseRivera }, MARTES_9H)).rejects.toMatchObject({
        codigo: "CLASE_FUERA_DE_HORARIO",
      });
      await expect(abrirSesion(docentes.rivera, { claseId: UUID_INEXISTENTE }, LUNES_10H)).rejects.toMatchObject({
        codigo: "NO_ENCONTRADO",
        estadoHttp: 404,
      });
    });

    it("si falta marcar a alguno responde «Existen alumnos sin estado de asistencia registrado» y no guarda nada", async () => {
      const incompleta = marcas({ diego: ["FALTA"], lucia: [null] });
      await expect(guardarAsistencia(docentes.rivera, sesionRivera, incompleta, meta, LUNES_10H)).rejects.toMatchObject(
        {
          codigo: "ASISTENCIA_INCOMPLETA",
          estadoHttp: 422,
          message: "Existen alumnos sin estado de asistencia registrado",
          detalles: { faltantes: [{ matriculaId: alumnos.lucia.matriculaId, nombre: "Álvarez Prueba, Lucía" }] },
        },
      );
      // un alumno de otra sección no entra en la lista
      await expect(
        guardarAsistencia(
          docentes.rivera,
          sesionRivera,
          marcas({ diego: ["FALTA"], lucia: ["PRESENTE"], valeria: ["PRESENTE"] }),
          meta,
          LUNES_10H,
        ),
      ).rejects.toMatchObject({ codigo: "ALUMNO_FUERA_DE_LA_CLASE" });
      expect(await prisma.asistenciaEstudiante.count({ where: { sesionClaseId: sesionRivera } })).toBe(0);
    });

    it("guarda la lista con la observación y avisa una sola vez al alumno y a su apoderado al llegar al umbral", async () => {
      const lista = marcas({ diego: ["FALTA", "  No avisó  "], lucia: ["PRESENTE"] });
      const r = await guardarAsistencia(docentes.rivera, sesionRivera, lista, meta, LUNES_10H);
      expect(r).toMatchObject({
        registrada: true,
        editable: true,
        registradaEn: LUNES_10H.toISOString(),
        editableHasta: "2089-03-15T15:00:00.000Z",
        resumen: { presentes: 1, ausentes: 1, sinMarcar: 0 },
        avisos: { avisos: 1, correos: 2 },
      });
      const diego = r.alumnos.find((a) => a.matriculaId === alumnos.diego.matriculaId)!;
      expect(diego).toMatchObject({ estado: "FALTA", faltas: 1, registradoPor: "K. Rivera", modificadoEn: null });
      const guardado = await prisma.asistenciaEstudiante.findUniqueOrThrow({ where: { id: diego.registroId! } });
      expect(guardado).toMatchObject({
        estado: "FALTA",
        observacion: "No avisó",
        registradoPorId: docentes.rivera.usuarioId,
        estadoAnterior: null,
      });
      expect(guardado.registradoEn.toISOString()).toBe(LUNES_10H.toISOString());

      // UMBRAL_FALTAS_MES = 1 en este año: la primera inasistencia del mes ya avisa a Diego y a su apoderada principal
      expect(correo.mock.calls.map(([c]) => c.para).sort()).toEqual([emailApoderadoA, emailDiego].sort());
      expect(correo.mock.calls[0][0].asunto).toBe("Kubo · 1 inasistencia injustificada en marzo");
      const avisos = await prisma.avisoAsistencia.findMany({ where: { matriculaId: alumnos.diego.matriculaId } });
      expect(avisos).toMatchObject([{ tipo: "FALTAS_MES", periodo: "2089-03", faltas: 1, correosEnviados: 2 }]);

      // la clase aparece como registrada en «clases de hoy»
      const hoy = await clasesDeHoy(docentes.rivera, LUNES_12H);
      expect(hoy.clases[0].sesion).toMatchObject({ id: sesionRivera, registrada: true, resumen: { ausentes: 1 } });
    });

    // ---------- US36 · Plazo de corrección ----------

    it("dentro del plazo el docente corrige y queda quién, cuándo y el estado anterior; el aviso no se repite", async () => {
      const aTardanza = marcas({ diego: ["TARDANZA", "Llegó 08:10"], lucia: ["PRESENTE"] });
      const r = await guardarAsistencia(docentes.rivera, sesionRivera, aTardanza, meta, LUNES_12H);
      const diego = r.alumnos.find((a) => a.matriculaId === alumnos.diego.matriculaId)!;
      expect(diego).toMatchObject({
        estado: "TARDANZA",
        estadoAnterior: "FALTA",
        observacion: "Llegó 08:10",
        modificadoPor: "K. Rivera",
        modificadoEn: LUNES_12H.toISOString(),
      });
      // Lucía no cambió: su registro no figura como corregido
      const lucia = r.alumnos.find((a) => a.matriculaId === alumnos.lucia.matriculaId)!;
      expect(lucia).toMatchObject({ estado: "PRESENTE", estadoAnterior: null, modificadoEn: null });
      // el plazo sigue contando desde el registro original, no desde la corrección
      expect(r.editableHasta).toBe("2089-03-15T15:00:00.000Z");

      // vuelve a «Ausente» al día siguiente, todavía en plazo: el umbral ya se avisó este mes y no se repite
      correo.mockClear();
      const aFalta = marcas({ diego: ["FALTA"], lucia: ["PRESENTE"] });
      const otra = await guardarAsistencia(docentes.rivera, sesionRivera, aFalta, meta, MARTES_9H);
      expect(otra.avisos).toEqual({ avisos: 0, correos: 0 });
      expect(correo).not.toHaveBeenCalled();
      expect(await prisma.avisoAsistencia.count({ where: { matriculaId: alumnos.diego.matriculaId } })).toBe(1);
    });

    it("pasadas las 24 horas responde «El plazo para modificar esta asistencia ha expirado (24 horas)»", async () => {
      const lista = marcas({ diego: ["PRESENTE"], lucia: ["PRESENTE"] });
      await expect(guardarAsistencia(docentes.rivera, sesionRivera, lista, meta, MARTES_11H)).rejects.toMatchObject({
        codigo: "PLAZO_CORRECCION_VENCIDO",
        estadoHttp: 422,
        message: "El plazo para modificar esta asistencia ha expirado (24 horas)",
      });
      const detalle = await detalleDeSesion(docentes.rivera, sesionRivera, MARTES_11H);
      expect(detalle).toMatchObject({
        editable: false,
        motivoSoloLectura: "El plazo para modificar esta asistencia ha expirado (24 horas)",
      });
      expect(detalle.alumnos.find((a) => a.matriculaId === alumnos.diego.matriculaId)?.estado).toBe("FALTA");

      // en sus registros anteriores la sesión aparece en solo lectura
      const anteriores = await listarSesiones(docentes.rivera, {}, MARTES_11H);
      expect(anteriores.sesiones).toMatchObject([{ id: sesionRivera, editable: false }]);
    });

    it("el administrador corrige fuera de plazo con motivo obligatorio y queda en la bitácora de auditoría", async () => {
      const registro = await prisma.asistenciaEstudiante.findFirstOrThrow({
        where: { sesionClaseId: sesionRivera, matriculaId: alumnos.diego.matriculaId },
      });
      // sin motivo (o con uno demasiado corto) la solicitud no pasa la validación
      for (const cuerpo of [{ estado: "FALTA_JUSTIFICADA" }, { estado: "FALTA_JUSTIFICADA", motivo: "  ok " }]) {
        expect(esquemasHorarios.CorreccionAsistenciaSchema.safeParse(cuerpo).success).toBe(false);
      }
      const motivo = "La apoderada presentó el certificado médico fuera del plazo de 24 horas.";
      const datos = esquemasHorarios.CorreccionAsistenciaSchema.parse({ estado: "FALTA_JUSTIFICADA", motivo });
      const r = await corregirAsistencia(admin, registro.id, datos, meta, SIGUIENTE_LUNES_10H);
      const diego = r.alumnos.find((a) => a.matriculaId === alumnos.diego.matriculaId)!;
      expect(diego).toMatchObject({
        estado: "FALTA_JUSTIFICADA",
        estadoAnterior: "FALTA",
        observacion: null,
        motivoCambio: motivo,
        modificadoEn: SIGUIENTE_LUNES_10H.toISOString(),
        dni: "90001021",
      });
      const corregido = await prisma.asistenciaEstudiante.findUniqueOrThrow({ where: { id: registro.id } });
      expect(corregido.modificadoPorId).toBe(admin.usuarioId);

      const auditoria = await prisma.registroAuditoria.findMany({
        where: { accion: "CORREGIR_ASISTENCIA", requestId: meta.requestId, entidadId: registro.id },
      });
      expect(auditoria).toHaveLength(1);
      expect(auditoria[0]).toMatchObject({
        usuarioId: admin.usuarioId,
        entidadAfectada: "asistencia_estudiante",
        motivo,
        valorAnterior: { estado: "FALTA", observacion: null },
        valorNuevo: { estado: "FALTA_JUSTIFICADA", fecha: LUNES, fueraDePlazo: true },
      });

      // repetir la misma corrección no cambia nada ni deja otra fila en la bitácora
      await expect(corregirAsistencia(admin, registro.id, datos, meta, SIGUIENTE_LUNES_10H)).rejects.toMatchObject({
        codigo: "ASISTENCIA_SIN_CAMBIOS",
        estadoHttp: 409,
      });
      await expect(corregirAsistencia(admin, UUID_INEXISTENTE, datos, meta)).rejects.toMatchObject({
        codigo: "NO_ENCONTRADO",
      });
      // el administrador ve todas las sesiones de la fecha
      const delDia = await listarSesiones(admin, { fecha: LUNES }, SIGUIENTE_LUNES_10H);
      expect(delDia.sesiones.map((s) => s.id).sort()).toEqual([sesionRivera, sesionSalas].sort());
    });

    // ---------- US45 y US52 · Portales ----------

    it("el apoderado ve el mes de su hijo por día, con la observación del docente y la alerta del mes", async () => {
      // Salas registra a Valeria ausente con una observación: su apoderado la verá en el resumen del mes
      const deSalas = marcas({ valeria: ["FALTA", "No asistió"] });
      await guardarAsistencia(docentes.salas, sesionSalas, deSalas, meta, LUNES_12H);

      const marzo = await asistenciaDelHijo(apoderadoA, alumnos.diego.estudianteId, "2089-03", SIGUIENTE_LUNES_10H);
      expect(marzo).toMatchObject({
        mes: "2089-03",
        resumen: { justificados: 1, ausentes: 0, diasConClases: 1 },
        incidencias: [{ fecha: LUNES, alcance: "DIA", estado: "JUSTIFICADO" }],
        alerta: null,
      });
      expect(marzo.calendario.find((d) => d.fecha === LUNES)?.estado).toBe("JUSTIFICADO");

      const porRuta = await pedir(asistenciaHijo, `/horarios/apoderado/hijos/x/asistencia?mes=2089-03`, {
        params: { id: alumnos.valeria.estudianteId },
        token: token.apoderadoB,
      });
      expect(porRuta.estado).toBe(200);
      expect(porRuta.datos).toMatchObject({
        resumen: { ausentes: 1 },
        incidencias: [{ estado: "AUSENTE", observacion: "No asistió" }],
        alerta: { mensaje: "Atención: 1 inasistencia injustificada este mes", fechas: [LUNES] },
      });

      // un mes sin registros llega vacío: la pantalla muestra «No hay registros de asistencia disponibles…»
      const abril = await asistenciaDelHijo(apoderadoA, alumnos.diego.estudianteId, "2089-04", SIGUIENTE_LUNES_10H);
      expect(abril).toMatchObject({ resumen: { diasConClases: 0, porcentajeAsistencia: null }, incidencias: [] });
    });

    it("el alumno ve sus acumulados del bimestre y del año, y el mensaje positivo si no tiene inasistencias", async () => {
      const diego = await asistenciaDelAlumno(alumnoDiego, SIGUIENTE_LUNES_10H);
      expect(diego).toMatchObject({
        anio: ANIO,
        bimestre: { nombre: "Bimestre I", faltas: 0, tardanzas: 0, justificadas: 1 },
        delAnio: { faltas: 0, justificadas: 1 },
        riesgo: { nivel: "SIN_RIESGO", porcentajeAviso: 15, porcentajeRiesgo: 20 },
        sinInasistencias: false,
      });
      expect(diego.detalle).toMatchObject([{ fecha: LUNES, estado: "JUSTIFICADO" }]);

      const porRuta = await pedir(asistenciaAlumno, "/horarios/alumno/asistencia", { token: token.diego });
      expect(porRuta.estado).toBe(200);
      expect(porRuta.datos.estudiante.estudianteId).toBe(alumnos.diego.estudianteId);
    });

    // ---------- Seguridad ----------

    it("sin sesión todos los endpoints de asistencia responden 401", async () => {
      const id = { id: sesionRivera };
      const llamadas = [
        pedir(clasesHoy, "/horarios/asistencia/clases-de-hoy"),
        pedir(listarSesionesRuta, "/horarios/asistencia/sesiones"),
        pedir(abrir, "/horarios/asistencia/sesiones", { metodo: "POST", cuerpo: { claseId: claseRivera } }),
        pedir(verSesion, "/horarios/asistencia/sesiones/x", { params: id }),
        pedir(guardarLista, "/horarios/asistencia/sesiones/x/registros", { params: id, metodo: "PUT", cuerpo: {} }),
        pedir(corregir, "/horarios/asistencia/registros/x/corregir", { params: id, metodo: "POST", cuerpo: {} }),
        pedir(asistenciaHijo, "/horarios/apoderado/hijos/x/asistencia", { params: { id: alumnos.diego.estudianteId } }),
        pedir(asistenciaAlumno, "/horarios/alumno/asistencia"),
      ];
      for (const r of await Promise.all(llamadas)) {
        expect(r).toMatchObject({ estado: 401, error: { code: "NO_AUTENTICADO" } });
      }
    });

    it("con otro perfil responden 403: la asistencia del docente, la corrección del administrador y los portales", async () => {
      const id = { id: sesionRivera };
      const llamadas = [
        pedir(clasesHoy, "/horarios/asistencia/clases-de-hoy", { token: token.apoderadoA }),
        pedir(listarSesionesRuta, "/horarios/asistencia/sesiones", { token: token.diego }),
        pedir(abrir, "/horarios/asistencia/sesiones", {
          token: token.diego,
          metodo: "POST",
          cuerpo: { claseId: claseRivera },
        }),
        pedir(verSesion, "/horarios/asistencia/sesiones/x", { params: id, token: token.apoderadoA }),
        pedir(guardarLista, "/horarios/asistencia/sesiones/x/registros", {
          params: id,
          token: token.apoderadoA,
          metodo: "PUT",
          cuerpo: {},
        }),
        // corregir fuera de plazo es solo del administrador: ni el docente dueño de la sesión puede
        pedir(corregir, "/horarios/asistencia/registros/x/corregir", {
          params: id,
          token: token.rivera,
          metodo: "POST",
          cuerpo: { estado: "PRESENTE", motivo: "Intento del docente" },
        }),
        pedir(asistenciaHijo, "/horarios/apoderado/hijos/x/asistencia", {
          params: { id: alumnos.diego.estudianteId },
          token: token.rivera,
        }),
        pedir(asistenciaAlumno, "/horarios/alumno/asistencia", { token: token.apoderadoA }),
      ];
      for (const r of await Promise.all(llamadas)) {
        expect(r).toMatchObject({ estado: 403, error: { code: "ACCESO_DENEGADO" } });
      }
    });

    it("un docente no ve ni modifica la sesión de otro docente", async () => {
      const ajena = await pedir(verSesion, "/horarios/asistencia/sesiones/x", {
        params: { id: sesionRivera },
        token: token.salas,
      });
      expect(ajena).toMatchObject({ estado: 403, error: { code: "CLASE_AJENA" } });
      const guardar = await pedir(guardarLista, "/horarios/asistencia/sesiones/x/registros", {
        params: { id: sesionRivera },
        token: token.salas,
        metodo: "PUT",
        cuerpo: marcas({ diego: ["PRESENTE"], lucia: ["PRESENTE"] }),
      });
      expect(guardar).toMatchObject({ estado: 403, error: { code: "CLASE_AJENA" } });
      const abrirAjena = await pedir(abrir, "/horarios/asistencia/sesiones", {
        token: token.salas,
        metodo: "POST",
        cuerpo: { claseId: claseRivera },
      });
      expect(abrirAjena).toMatchObject({ estado: 403, error: { code: "CLASE_AJENA" } });

      // la suya sí la ve, y en su lista de sesiones no aparece la del otro docente
      const propia = await pedir(verSesion, "/horarios/asistencia/sesiones/x", {
        params: { id: sesionSalas },
        token: token.salas,
      });
      expect(propia.estado).toBe(200);
      expect(propia.datos.alumnos.map((a: { nombre: string }) => a.nombre)).toEqual(["Rojas Prueba, Valeria"]);
      const deSalas = await pedir(listarSesionesRuta, `/horarios/asistencia/sesiones?fecha=${LUNES}`, {
        token: token.salas,
      });
      expect(deSalas.datos.sesiones.map((s: { id: string }) => s.id)).toEqual([sesionSalas]);
    });

    it("un apoderado solo consulta a sus hijos y un alumno, solo su propia asistencia", async () => {
      const ajeno = await pedir(asistenciaHijo, "/horarios/apoderado/hijos/x/asistencia", {
        params: { id: alumnos.diego.estudianteId },
        token: token.apoderadoB,
      });
      expect(ajeno).toMatchObject({ estado: 403, error: { code: "ESTUDIANTE_NO_VINCULADO" } });
      const mesInvalido = await pedir(asistenciaHijo, "/horarios/apoderado/hijos/x/asistencia?mes=2089-13", {
        params: { id: alumnos.diego.estudianteId },
        token: token.apoderadoA,
      });
      expect(mesInvalido).toMatchObject({ estado: 400, error: { code: "DATOS_INVALIDOS" } });
      // el alumno no envía ningún identificador: siempre recibe lo suyo
      const propio = await pedir(asistenciaAlumno, "/horarios/alumno/asistencia", { token: token.diego });
      expect(propio.datos).toMatchObject({ estudiante: { estudianteId: alumnos.diego.estudianteId } });
    });
  },
);
