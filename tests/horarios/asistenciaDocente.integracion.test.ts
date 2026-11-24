// Prueba de integración (US32, AD-14): registro de ingreso de docentes. Puntual y Tardanza con la hora exacta, falta
// automática a la hora límite (idempotente y solo en días lectivos), la falta que pasa a Tardanza al llegar tarde, la
// salida, la justificación con auditoría, el bloqueo del registro de otra fecha y los permisos de cada endpoint.
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/horarios/asistenciaDocente
// Crea sus propios datos ficticios en el año 2080 (en curso, con un bimestre) y DNI 900019xx, y los borra al terminar.
// Los casos de uso reciben la hora («ahora») como parámetro: la prueba no depende del día en que se ejecuta.
import "@/server/wiring";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/platform/auth/tokens";
import { prisma } from "@/platform/db/prisma";
import { POST as justificarRuta } from "@/app/api/v1/horarios/asistencia-docente/[id]/justificar/route";
import { POST as ingresoRuta } from "@/app/api/v1/horarios/asistencia-docente/ingreso/route";
import { GET as listadoRuta } from "@/app/api/v1/horarios/asistencia-docente/route";
import {
  asistenciaDocenteDelDia,
  justificarFalta,
  marcarFaltasDocentes,
  registrarIngreso,
  registrarSalida,
} from "@/modules/horarios";
import { iniciarSesion, type Autenticado } from "@/modules/identidad";

vi.mock("@/platform/correo", () => ({
  enviarCorreo: vi.fn(async () => true),
  smtpConfigurado: () => false,
}));

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
const ANIO = 2080;
// contraseña ficticia de las cuentas que crea la prueba (cumple la política; no es de ninguna cuenta real)
const CLAVE = "Prueba-Kubo-2080";
// la bitácora es inmutable y conserva las filas de corridas anteriores: cada corrida usa su propio requestId
const meta = { requestId: `prueba-asistencia-docente-${Date.now()}`, ip: null, userAgent: null };
const ESPERA_PREPARACION = 120_000;

// Fechas fijas del año ficticio. El 04/03/2080 es lunes; las horas van en UTC (Lima es UTC−5).
const LUNES = "2080-03-04";
const MARTES = "2080-03-05";
const enLima = (fecha: string, hora: string) => {
  const [h, m, s = "00"] = hora.split(":");
  return new Date(`${fecha}T${String(Number(h) + 5).padStart(2, "0")}:${m}:${s}Z`);
};

type Manejador = (req: NextRequest, contexto: { params: Promise<Record<string, string>> }) => Promise<Response>;

async function pedir(
  manejador: Manejador,
  ruta: string,
  opciones: { token?: string; params?: Record<string, string>; metodo?: "POST"; cuerpo?: unknown } = {},
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

describe.skipIf(!ACTIVA)("asistencia docente: ingreso, falta automática, salida y justificación (US32)", () => {
  let admin: Autenticado;
  let anioId: string;
  const personas: string[] = [];
  const docente: Record<"perez" | "torres" | "salas", string> = { perez: "", torres: "", salas: "" };
  const token: Record<string, string> = {};

  const registrosDe = (fecha: string) =>
    prisma.asistenciaDocente.findMany({
      where: { fecha: new Date(`${fecha}T00:00:00Z`), docenteId: { in: Object.values(docente) } },
    });
  const auditoria = (entidadId: string, accion: string) =>
    prisma.registroAuditoria.findFirst({ where: { entidadId, accion, entidadAfectada: "asistencia_docente" } });

  beforeAll(async () => {
    process.env.JWT_SECRET ??= "clave-de-firma-solo-para-pruebas-de-integracion";
    const u = await prisma.usuario.findFirstOrThrow({ where: { email: "admin@kubo.edu.pe" } });
    admin = {
      usuarioId: u.id,
      sesionId: "prueba",
      personaId: u.personaId,
      email: u.email,
      rol: "ADMINISTRADOR",
      debeCambiarPassword: false,
    };
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
        fechaInicio: new Date(`${ANIO}-03-04T00:00:00Z`),
        fechaFin: new Date(`${ANIO}-05-10T00:00:00Z`),
        estado: "ACTIVO",
      },
    });

    const passwordHash = await hashPassword(CLAVE);
    const ingresar = async (personaId: string, email: string) => {
      await prisma.usuario.create({
        data: { personaId, email, passwordHash, estado: "ACTIVO", debeCambiarPassword: false },
      });
      const r = await iniciarSesion({ email, password: CLAVE, recordar: false }, meta);
      if (r.tipo !== "SESION") throw new Error("La cuenta de prueba debe tener un solo perfil");
      return r.tokens.acceso;
    };
    for (const [clave, dni, nombres, apellidos, especialidad] of [
      ["perez", "90001901", "Juan", "Pérez Prueba", "Matemática"],
      ["torres", "90001902", "Mónica", "Torres Prueba", "Comunicación"],
      ["salas", "90001903", "Raúl", "Salas Prueba", "Ciencia y Tecnología"],
    ] as const) {
      const p = await prisma.persona.create({
        data: { dni, nombres, apellidos, email: `${dni}@prueba.kubo.test`, docente: { create: { especialidad } } },
        include: { docente: true },
      });
      personas.push(p.id);
      docente[clave] = p.docente!.id;
    }
    token.docente = await ingresar(personas[0], "90001901@prueba.kubo.test");
    // administradora propia para llamar a la API: solo se usa en rechazos y lecturas, que no auditan
    const a = await prisma.persona.create({
      data: {
        dni: "90001910",
        nombres: "Rosa",
        apellidos: "Admin Prueba",
        email: "90001910@prueba.kubo.test",
        administrador: { create: {} },
      },
    });
    personas.push(a.id);
    token.admin = await ingresar(a.id, "90001910@prueba.kubo.test");
  }, ESPERA_PREPARACION);

  afterAll(async () => {
    if (!anioId) return;
    await prisma.asistenciaDocente.deleteMany({ where: { docenteId: { in: Object.values(docente).filter(Boolean) } } });
    await prisma.usuario.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.docente.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.administrador.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.persona.deleteMany({ where: { id: { in: personas } } });
    await prisma.periodoEvaluacion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.anioAcademico.delete({ where: { id: anioId } });
    await prisma.$disconnect();
  }, ESPERA_PREPARACION);

  it("permisos: sin sesión 401 y un docente no ve ni registra la asistencia del personal (403)", async () => {
    expect((await pedir(listadoRuta, `/horarios/asistencia-docente?fecha=${LUNES}`)).estado).toBe(401);
    const comoDocente = await pedir(listadoRuta, `/horarios/asistencia-docente?fecha=${LUNES}`, {
      token: token.docente,
    });
    expect(comoDocente.estado).toBe(403);
    const ingreso = await pedir(ingresoRuta, "/horarios/asistencia-docente/ingreso", {
      token: token.docente,
      metodo: "POST",
      cuerpo: { docenteId: docente.perez, fecha: LUNES },
    });
    expect(ingreso.estado).toBe(403);
  });

  it("bloquea el registro de una fecha distinta al día actual de Lima (US32, criterio 3)", async () => {
    const r = await pedir(ingresoRuta, "/horarios/asistencia-docente/ingreso", {
      token: token.admin,
      metodo: "POST",
      cuerpo: { docenteId: docente.perez, fecha: LUNES },
    });
    expect(r.estado).toBe(422);
    expect(r.error).toMatchObject({
      code: "SOLO_DIA_ACTUAL",
      message: "Solo se puede registrar la asistencia del día actual",
    });
    expect(await registrosDe(LUNES)).toHaveLength(0);
  });

  it("el administrador ve a los docentes activos sin marcar", async () => {
    const r = await pedir(listadoRuta, `/horarios/asistencia-docente?fecha=${LUNES}`, { token: token.admin });
    expect(r.estado).toBe(200);
    const mios = (r.datos.docentes as { docenteId: string; registro: unknown; especialidad: string }[]).filter((d) =>
      Object.values(docente).includes(d.docenteId),
    );
    expect(mios).toHaveLength(3);
    expect(mios.every((d) => d.registro === null)).toBe(true);
  });

  it("registra la hora exacta: Puntual hasta las 07:30 y Tardanza después (US32, criterio 1)", async () => {
    const perez = await registrarIngreso(
      admin,
      { docenteId: docente.perez, fecha: LUNES },
      meta,
      enLima(LUNES, "07:30:40"),
    );
    expect(perez).toMatchObject({ estado: "PUNTUAL", horaIngreso: "07:30", automatica: false });
    const torres = await registrarIngreso(
      admin,
      { docenteId: docente.torres, fecha: LUNES },
      meta,
      enLima(LUNES, "07:31:00"),
    );
    expect(torres).toMatchObject({ estado: "TARDANZA", horaIngreso: "07:31" });
    const guardado = await prisma.asistenciaDocente.findUniqueOrThrow({ where: { id: perez.id } });
    expect(guardado.horaIngreso?.toISOString().slice(11, 19)).toBe("07:30:40");
    expect(await auditoria(perez.id, "REGISTRAR_INGRESO_DOCENTE")).not.toBeNull();
    await expect(
      registrarIngreso(admin, { docenteId: docente.perez, fecha: LUNES }, meta, enLima(LUNES, "07:45:00")),
    ).rejects.toMatchObject({ codigo: "INGRESO_YA_REGISTRADO" });
  });

  it("antes de la hora límite la verificación automática no marca a nadie", async () => {
    const r = await marcarFaltasDocentes(enLima(LUNES, "07:59:59"));
    expect(r).toMatchObject({ marcadas: 0 });
    expect(r.omitida).toContain("08:00");
    expect(await registrosDe(LUNES)).toHaveLength(2);
  });

  it("a la hora límite marca Inasistencia al docente sin marcar, una sola vez (US32, criterio 2)", async () => {
    const primera = await marcarFaltasDocentes(enLima(LUNES, "08:00:00"));
    expect(primera.omitida).toBeNull();
    expect(primera.marcadas).toBeGreaterThanOrEqual(1);
    const falta = (await registrosDe(LUNES)).find((r) => r.docenteId === docente.salas)!;
    expect(falta).toMatchObject({ estado: "FALTA", registradoPorId: null, horaIngreso: null });
    expect(await auditoria(falta.id, "MARCAR_FALTA_DOCENTE")).not.toBeNull();

    // el timer vuelve a correr cada 15 minutos: no duplica ni cambia nada
    const segunda = await marcarFaltasDocentes(enLima(LUNES, "08:15:00"));
    expect(segunda.marcadas).toBe(0);
    expect(await registrosDe(LUNES)).toHaveLength(3);
  });

  it("si el docente llega después, la falta automática pasa a Tardanza con la hora real (auditado)", async () => {
    const r = await registrarIngreso(
      admin,
      { docenteId: docente.salas, fecha: LUNES },
      meta,
      enLima(LUNES, "08:20:15"),
    );
    expect(r).toMatchObject({ estado: "TARDANZA", horaIngreso: "08:20", automatica: false });
    const evento = await auditoria(r.id, "REEMPLAZAR_FALTA_DOCENTE");
    expect(evento?.valorAnterior).toMatchObject({ estado: "FALTA", automatica: true });
    expect(evento?.valorNuevo).toMatchObject({ estado: "TARDANZA", horaIngreso: "08:20:15" });
  });

  it("no verifica en un día no lectivo (sábado)", async () => {
    const r = await marcarFaltasDocentes(enLima("2080-03-09", "09:00:00"));
    expect(r).toMatchObject({ marcadas: 0 });
    expect(r.omitida).toContain("fin de semana");
    expect(await registrosDe("2080-03-09")).toHaveLength(0);
  });

  it("registra la salida una sola vez", async () => {
    const r = await registrarSalida(admin, { docenteId: docente.perez, fecha: LUNES }, meta, enLima(LUNES, "13:25:00"));
    expect(r).toMatchObject({ horaIngreso: "07:30", horaSalida: "13:25" });
    await expect(
      registrarSalida(admin, { docenteId: docente.perez, fecha: LUNES }, meta, enLima(LUNES, "13:40:00")),
    ).rejects.toMatchObject({ codigo: "SALIDA_YA_REGISTRADA" });
  });

  it("justifica una inasistencia de cualquier fecha con motivo, con auditoría", async () => {
    await marcarFaltasDocentes(enLima(MARTES, "08:10:00"));
    const falta = (await registrosDe(MARTES)).find((r) => r.docenteId === docente.torres)!;
    expect(falta.estado).toBe("FALTA");

    const comoDocente = await pedir(justificarRuta, `/horarios/asistencia-docente/${falta.id}/justificar`, {
      token: token.docente,
      metodo: "POST",
      params: { id: falta.id },
      cuerpo: { motivo: "Descanso médico" },
    });
    expect(comoDocente.estado).toBe(403);

    const r = await justificarFalta(admin, falta.id, { motivo: "Descanso médico por dos días" }, meta);
    expect(r).toMatchObject({ estado: "FALTA_JUSTIFICADA", justificacion: "Descanso médico por dos días" });
    const evento = await auditoria(falta.id, "JUSTIFICAR_FALTA_DOCENTE");
    expect(evento?.motivo).toBe("Descanso médico por dos días");
    expect(evento?.valorAnterior).toMatchObject({ estado: "FALTA" });
    await expect(justificarFalta(admin, falta.id, { motivo: "Otra vez" }, meta)).rejects.toMatchObject({
      codigo: "NO_ES_INASISTENCIA",
    });
  });

  it("el listado del día refleja cada estado y sus contadores", async () => {
    const dia = await asistenciaDocenteDelDia({ fecha: LUNES }, enLima(LUNES, "13:30:00"));
    const porId = new Map(dia.docentes.map((d) => [d.docenteId, d]));
    expect(porId.get(docente.perez)?.registro).toMatchObject({ estado: "PUNTUAL", horaSalida: "13:25" });
    expect(porId.get(docente.torres)?.registro?.estado).toBe("TARDANZA");
    expect(porId.get(docente.salas)?.registro?.estado).toBe("TARDANZA");
    expect(porId.get(docente.perez)?.especialidad).toBe("Matemática");
    expect(dia.diaNoLectivo).toBeNull();
    expect(dia.horaLimite).toBe("08:00");
  });
});
