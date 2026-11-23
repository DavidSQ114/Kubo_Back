// Prueba de integración (D-14): orden de pago de las cuotas por la API. Con la matrícula pendiente, el pago manual de
// una pensión (US22) y la creación del intento en línea (US70) responden 409 MATRICULA_PENDIENTE; saltarse una pensión
// responde 409 CUOTAS_ANTERIORES_PENDIENTES; en orden, el pago pasa.
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/matricula/ordenPago.integracion
// Crea sus propios datos ficticios en el año 2083 (DNI 900016xx) y los borra al terminar. Las llamadas por la API solo
// cubren rechazos (no auditan): el pago que sí se registra lo firma el administrador del seed.
import "@/server/wiring";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "@/platform/auth/tokens";
import { prisma } from "@/platform/db/prisma";
import { POST as pagoManualRuta } from "@/app/api/v1/matricula/pagos/route";
import { POST as intentoRuta } from "@/app/api/v1/matricula/apoderado/pagos/intentos/route";
import { iniciarSesion, type Autenticado } from "@/modules/identidad";
import { confirmarMatricula, crearIntentoPago, registrarPago } from "@/modules/matricula";

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
const ANIO = 2083;
// contraseña ficticia de las cuentas que crea la prueba (cumple la política; no es de ninguna cuenta real)
const CLAVE = "Prueba-Kubo-2083";
const HOY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
const meta = { requestId: `prueba-orden-pago-${Date.now()}`, ip: null, userAgent: null };
const URL_BASE = "http://localhost:3000";

process.env.PASARELA = "falsa";
process.env.MP_WEBHOOK_SECRET ??= "secreto-de-prueba-integracion-0123";

type Manejador = (req: NextRequest, contexto: { params: Promise<Record<string, string>> }) => Promise<Response>;

async function pedir(manejador: Manejador, ruta: string, token: string, cuerpo: unknown) {
  const req = new NextRequest(`http://localhost/api/v1${ruta}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify(cuerpo),
  });
  const res = await manejador(req, { params: Promise.resolve({}) });
  const json = await res.json();
  return { estado: res.status, error: json.error as { code: string; message: string } | undefined };
}

describe.skipIf(!ACTIVA)("orden de pago de las cuotas por la API (D-14, US22, US70)", () => {
  let admin: Autenticado;
  let anioId: string;
  let estudianteId: string;
  let matriculaId: string;
  let apoderado: Autenticado;
  const personas: string[] = [];
  const token = { admin: "", apoderado: "" };
  let cuotaMatricula: { id: string; monto: string; concepto: string };
  let pensiones: { id: string; monto: string; concepto: string }[] = [];

  const pagoManual = (cuotas: { id: string; monto: string }[], numero: string) => ({
    conceptoIds: cuotas.map((c) => c.id),
    monto: (cuotas.reduce((t, c) => t + Math.round(Number(c.monto) * 100), 0) / 100).toFixed(2),
    medioPago: "TRANSFERENCIA" as const,
    numeroOperacion: numero,
    fechaPago: HOY,
  });

  async function ingresar(email: string) {
    const r = await iniciarSesion({ email, password: CLAVE, recordar: false }, meta);
    if (r.tipo !== "SESION") throw new Error("La cuenta de prueba debe tener un solo perfil");
    return r.tokens.acceso;
  }

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
    const grado = await prisma.grado.findFirstOrThrow({ where: { numero: 2 } });
    anioId = (
      await prisma.anioAcademico.create({
        data: {
          anio: ANIO,
          fechaInicio: new Date(`${ANIO}-03-01T00:00:00Z`),
          fechaFin: new Date(`${ANIO}-12-15T00:00:00Z`),
          estado: "EN_MATRICULA",
        },
      })
    ).id;
    for (const [clave, valor] of [
      ["MONTO_MATRICULA", "300.00"],
      ["MONTO_PENSION", "400.00"],
    ]) {
      await prisma.parametroInstitucion.create({
        data: { anioAcademicoId: anioId, clave, valor, actualizadoPorId: u.id },
      });
    }
    const seccion = await prisma.seccion.create({
      data: { anioAcademicoId: anioId, gradoId: grado.id, nombre: "O", aforoMaximo: 5 },
    });
    const passwordHash = await hashPassword(CLAVE);
    const pAdmin = await prisma.persona.create({
      data: {
        dni: "90001601",
        nombres: "Prueba",
        apellidos: "Tesorera Orden",
        email: "90001601@prueba.kubo.test",
        administrador: { create: {} },
      },
    });
    const pApoderado = await prisma.persona.create({
      data: {
        dni: "90001602",
        nombres: "Prueba",
        apellidos: "Apoderado Orden",
        email: "90001602@prueba.kubo.test",
        apoderado: { create: {} },
      },
      include: { apoderado: true },
    });
    const pEstudiante = await prisma.persona.create({
      data: {
        dni: "90001603",
        nombres: "Prueba",
        apellidos: "Estudiante Orden",
        estudiante: { create: { gradoIngresoId: grado.id } },
      },
      include: { estudiante: true },
    });
    personas.push(pAdmin.id, pApoderado.id, pEstudiante.id);
    for (const p of [pAdmin, pApoderado]) {
      await prisma.usuario.create({
        data: { personaId: p.id, email: p.email!, passwordHash, estado: "ACTIVO", debeCambiarPassword: false },
      });
    }
    estudianteId = pEstudiante.estudiante!.id;
    const v = await prisma.vinculoApoderado.create({
      data: { estudianteId, apoderadoId: pApoderado.apoderado!.id, parentesco: "Madre", esPrincipal: true },
    });
    const m = await confirmarMatricula(
      admin,
      {
        estudianteId,
        anioAcademicoId: anioId,
        seccionId: seccion.id,
        vinculoResponsableId: v.id,
        modalidadPago: "MENSUAL",
      },
      meta,
    );
    matriculaId = m.matriculaId;
    const cuota = (c: (typeof m.cronograma.cuotas)[number]) => ({ id: c.id!, monto: c.monto, concepto: c.concepto });
    cuotaMatricula = cuota(m.cronograma.cuotas.find((c) => c.tipo === "MATRICULA")!);
    pensiones = m.cronograma.cuotas
      .filter((c) => c.tipo === "PENSION")
      .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento))
      .map(cuota);
    token.admin = await ingresar(pAdmin.email!);
    token.apoderado = await ingresar(pApoderado.email!);
    const usuarioApoderado = await prisma.usuario.findFirstOrThrow({ where: { personaId: pApoderado.id } });
    apoderado = {
      usuarioId: usuarioApoderado.id,
      sesionId: "prueba",
      personaId: pApoderado.id,
      email: pApoderado.email!,
      rol: "APODERADO",
      debeCambiarPassword: false,
    };
  });

  afterAll(async () => {
    if (!anioId) return;
    await prisma.intentoPago.deleteMany({ where: { matriculaId } });
    const ops = await prisma.operacionPago.findMany({
      where: { pagos: { some: { conceptoCobro: { matriculaId } } } },
      select: { id: true },
    });
    const ids = ops.map((o) => o.id);
    await prisma.comprobante.deleteMany({ where: { operacionPagoId: { in: ids } } });
    await prisma.operacionPago.deleteMany({ where: { id: { in: ids } } });
    await prisma.matricula.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.usuario.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.vinculoApoderado.deleteMany({ where: { estudiante: { personaId: { in: personas } } } });
    await prisma.estudiante.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.apoderado.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.administrador.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.persona.deleteMany({ where: { id: { in: personas } } });
    await prisma.seccion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.parametroInstitucion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.anioAcademico.delete({ where: { id: anioId } });
    await prisma.$disconnect();
  });

  const operacionesDeLaMatricula = () =>
    prisma.operacionPago.count({ where: { pagos: { some: { conceptoCobro: { matriculaId } } } } });

  it("el pago manual de una pensión con la matrícula pendiente responde 409 MATRICULA_PENDIENTE", async () => {
    const r = await pedir(
      pagoManualRuta,
      "/matricula/pagos",
      token.admin,
      pagoManual(pensiones.slice(0, 3), "ORDEN-1"),
    );
    expect(r.estado).toBe(409);
    expect(r.error).toMatchObject({
      code: "MATRICULA_PENDIENTE",
      message: `Primero debe pagarse la matrícula ${ANIO}. Inclúyela en este pago o regístrala antes.`,
    });
    expect(await operacionesDeLaMatricula()).toBe(0);
  });

  it("crear el intento en línea de una pensión con la matrícula pendiente responde 409 MATRICULA_PENDIENTE", async () => {
    const r = await pedir(intentoRuta, "/matricula/apoderado/pagos/intentos", token.apoderado, {
      estudianteId,
      conceptoIds: [pensiones[0].id],
    });
    expect(r.estado).toBe(409);
    expect(r.error?.code).toBe("MATRICULA_PENDIENTE");
    expect(await prisma.intentoPago.count({ where: { matriculaId } })).toBe(0);
  });

  it("saltarse una pensión responde 409 CUOTAS_ANTERIORES_PENDIENTES con las cuotas que faltan", async () => {
    const r = await pedir(
      pagoManualRuta,
      "/matricula/pagos",
      token.admin,
      pagoManual([cuotaMatricula, pensiones[1]], "ORDEN-2"),
    );
    expect(r.estado).toBe(409);
    expect(r.error).toMatchObject({
      code: "CUOTAS_ANTERIORES_PENDIENTES",
      message: `Primero deben pagarse las cuotas anteriores: ${pensiones[0].concepto}.`,
    });
    expect(await operacionesDeLaMatricula()).toBe(0);
  });

  it("la matrícula y la primera pensión en la misma operación se registran", async () => {
    const r = await registrarPago(admin, pagoManual([cuotaMatricula, pensiones[0]], `ORDEN-3-${Date.now()}`), meta);
    expect(r.operacion.estado).toBe("CONFIRMADO");
  });

  it("después, el intento en línea exige seguir el orden de vencimiento", async () => {
    const r = await pedir(intentoRuta, "/matricula/apoderado/pagos/intentos", token.apoderado, {
      estudianteId,
      conceptoIds: [pensiones[2].id],
    });
    expect(r.estado).toBe(409);
    expect(r.error).toMatchObject({
      code: "CUOTAS_ANTERIORES_PENDIENTES",
      message: `Primero deben pagarse las cuotas anteriores: ${pensiones[1].concepto}.`,
    });
    const enOrden = await crearIntentoPago(apoderado, {
      estudianteId,
      conceptoIds: [pensiones[1].id, pensiones[2].id],
      urlBase: URL_BASE,
    });
    expect(enOrden.monto).toBe("800.00");
  });
});
