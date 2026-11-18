// Prueba de integración (US55, US59): notificaciones internas de la campana, bandeja de salida de correos con
// reintentos y recordatorios de pago a apoderados morosos. Seguridad (401 sin sesión, 403 con otro perfil, nadie lee
// ni marca notificaciones ajenas), «Marcar como leídas», notificación del pago confirmado en su misma transacción,
// recordatorio solo a quien sigue con cuotas vencidas, fecha del último recordatorio, auditoría ENVIAR_RECORDATORIOS y
// un correo que falla: queda pendiente, se reintenta hasta 5 veces y la operación no se revierte.
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/platform/notificaciones.integracion
// Crea sus propios datos ficticios en el año 2085 (DNI 900014xx) y los borra al terminar (la auditoría es inmutable: el
// actor de lo auditado es el administrador del seed; la administradora de prueba solo usa la API en casos que no se
// auditan). Las filas de la bandeja de salida no tienen clave foránea: se borran las que crea la prueba.
import "@/server/wiring";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/platform/auth/tokens";
import { enviarCorreo } from "@/platform/correo";
import { prisma } from "@/platform/db/prisma";
import { procesarBandeja } from "@/platform/notificaciones";
import { POST as recordatoriosRuta } from "@/app/api/v1/matricula/morosidad/recordatorios/route";
import { POST as marcarRuta } from "@/app/api/v1/notificaciones/marcar-leidas/route";
import { GET as noLeidasRuta } from "@/app/api/v1/notificaciones/no-leidas/route";
import { GET as listarRuta } from "@/app/api/v1/notificaciones/route";
import { iniciarSesion, type Autenticado } from "@/modules/identidad";
import { confirmarMatricula, enviarRecordatoriosPago, panelMorosidad, registrarPago } from "@/modules/matricula";

vi.mock("@/platform/correo", () => ({
  enviarCorreo: vi.fn(async () => true),
  smtpConfigurado: () => false,
}));

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
const ANIO = 2085;
// contraseña ficticia de las cuentas que crea la prueba (cumple la política; no es de ninguna cuenta real)
const CLAVE = "Prueba-Kubo-2085";
const meta = { requestId: `prueba-notificaciones-${Date.now()}`, ip: null, userAgent: null };
const ESPERA_PREPARACION = 120_000;
const ID_INEXISTENTE = "00000000-0000-4000-8000-000000000000";

type Manejador = (req: NextRequest, contexto: { params: Promise<Record<string, string>> }) => Promise<Response>;

async function pedir(
  manejador: Manejador,
  ruta: string,
  opciones: { token?: string; metodo?: "POST"; cuerpo?: unknown } = {},
) {
  const req = new NextRequest(`http://localhost/api/v1${ruta}`, {
    method: opciones.metodo ?? "GET",
    headers: opciones.token ? { authorization: `Bearer ${opciones.token}` } : undefined,
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
  });
  const res = await manejador(req, { params: Promise.resolve({}) });
  const json = await res.json();
  return {
    estado: res.status,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- respuesta JSON de la API, se revisa campo a campo
    datos: json.data as any,
    error: json.error as { code: string; message: string } | undefined,
  };
}

describe.skipIf(!ACTIVA)("notificaciones, bandeja de salida y recordatorios de pago (US55, US59)", () => {
  let anioId: string;
  let admin: Autenticado;
  const personas: string[] = [];
  const matriculas: Record<"valeria" | "diego" | "bruno", string> = { valeria: "", diego: "", bruno: "" };
  const token: Record<"admin" | "apoderada" | "docente" | "valeria", string> = {
    admin: "",
    apoderada: "",
    docente: "",
    valeria: "",
  };
  const emails = {
    apoderada: "90001401@prueba.kubo.test",
    docente: "90001410@prueba.kubo.test",
    adminPrueba: "90001411@prueba.kubo.test",
    valeria: "90001421@prueba.kubo.test",
  };
  const usuarios: Record<"apoderada" | "docente", string> = { apoderada: "", docente: "" };
  const correo = vi.mocked(enviarCorreo);

  async function ingresar(email: string) {
    const r = await iniciarSesion({ email, password: CLAVE, recordar: false }, meta);
    if (r.tipo !== "SESION") throw new Error("La cuenta de prueba debe tener un solo perfil");
    return r.tokens.acceso;
  }

  /** Correos de la bandeja de salida dirigidos a la apoderada de la prueba. */
  const correosDeApoderada = () =>
    prisma.outboxEvento.findMany({
      where: { tipoEvento: "CORREO", payload: { path: ["para"], equals: emails.apoderada } },
      orderBy: { createdAt: "asc" },
    });

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
    const passwordHash = await hashPassword(CLAVE);
    const cuenta = async (personaId: string, email: string) =>
      (
        await prisma.usuario.create({
          data: { personaId, email, passwordHash, estado: "ACTIVO", debeCambiarPassword: false },
        })
      ).id;

    const grado = await prisma.grado.findFirstOrThrow({ where: { numero: 1 } });
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
    ] as const) {
      await prisma.parametroInstitucion.create({
        data: { anioAcademicoId: anioId, clave, valor, actualizadoPorId: u.id },
      });
    }
    const seccionId = (
      await prisma.seccion.create({
        data: { anioAcademicoId: anioId, gradoId: grado.id, nombre: "NA", aforoMaximo: 5 },
      })
    ).id;

    // docente (otro perfil) y una administradora de prueba con cuenta (para usar la API como administradora)
    const pDocente = await prisma.persona.create({
      data: {
        dni: "90001410",
        nombres: "Rosa",
        apellidos: "Aviso Prueba",
        email: emails.docente,
        docente: { create: {} },
      },
    });
    personas.push(pDocente.id);
    usuarios.docente = await cuenta(pDocente.id, emails.docente);
    const pAdmin = await prisma.persona.create({
      data: {
        dni: "90001411",
        nombres: "Inés",
        apellidos: "Tesorería Prueba",
        email: emails.adminPrueba,
        administrador: { create: {} },
      },
    });
    personas.push(pAdmin.id);
    await cuenta(pAdmin.id, emails.adminPrueba);

    // apoderada con cuenta y correo: Valeria (alumna con cuenta) y Diego. Bruno: su apoderado no tiene cuenta ni correo
    const apoderado = async (dni: string, email: string | null) => {
      const p = await prisma.persona.create({
        data: { dni, nombres: "Carmen", apellidos: `Apoderada ${dni}`, email, apoderado: { create: {} } },
        include: { apoderado: true },
      });
      personas.push(p.id);
      if (email) usuarios.apoderada = await cuenta(p.id, email);
      return p.apoderado!.id;
    };
    const apoderada = await apoderado("90001401", emails.apoderada);
    const sinContacto = await apoderado("90001402", null);
    for (const [clave, dni, nombres, apoderadoId] of [
      ["valeria", "90001421", "Valeria", apoderada],
      ["diego", "90001422", "Diego", apoderada],
      ["bruno", "90001423", "Bruno", sinContacto],
    ] as const) {
      const es = await prisma.persona.create({
        data: { dni, nombres, apellidos: "Quispe Prueba", estudiante: { create: { gradoIngresoId: grado.id } } },
        include: { estudiante: true },
      });
      personas.push(es.id);
      const v = await prisma.vinculoApoderado.create({
        data: { estudianteId: es.estudiante!.id, apoderadoId, parentesco: "Madre", esPrincipal: true },
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
      matriculas[clave] = m.matriculaId;
      if (clave === "valeria") await cuenta(es.id, emails.valeria);
    }
    // Valeria y Bruno con 2 pensiones vencidas respecto de hoy (la consulta usa la fecha real); Diego, al día
    for (const clave of ["valeria", "bruno"] as const) {
      const pensiones = await prisma.conceptoCobro.findMany({
        where: { matriculaId: matriculas[clave], tipo: "PENSION" },
        orderBy: { fechaVencimiento: "asc" },
        take: 2,
      });
      for (const [i, p] of pensiones.entries()) {
        await prisma.conceptoCobro.update({
          where: { id: p.id },
          data: { fechaVencimiento: new Date(`2026-0${i + 1}-05T00:00:00Z`) },
        });
      }
    }
    // Diego no debe tener nada vencido (la cuota de matrícula vence el día de la matrícula)
    await prisma.conceptoCobro.updateMany({
      where: { matriculaId: matriculas.diego },
      data: { fechaVencimiento: new Date(`${ANIO}-12-31T00:00:00Z`) },
    });

    token.admin = await ingresar(emails.adminPrueba);
    token.apoderada = await ingresar(emails.apoderada);
    token.docente = await ingresar(emails.docente);
    token.valeria = await ingresar(emails.valeria);
  }, ESPERA_PREPARACION);

  afterAll(async () => {
    if (!anioId) return;
    await prisma.outboxEvento.deleteMany({
      where: { tipoEvento: "CORREO", agregadoId: { in: Object.values(matriculas).filter(Boolean) } },
    });
    await prisma.outboxEvento.deleteMany({
      where: { tipoEvento: "CORREO", payload: { path: ["para"], equals: emails.apoderada } },
    });
    const ops = await prisma.operacionPago.findMany({
      where: { pagos: { some: { conceptoCobro: { matricula: { anioAcademicoId: anioId } } } } },
      select: { id: true },
    });
    await prisma.comprobante.deleteMany({ where: { operacionPagoId: { in: ops.map((o) => o.id) } } });
    await prisma.operacionPago.deleteMany({ where: { id: { in: ops.map((o) => o.id) } } });
    // las notificaciones se van con la cuenta de cada usuario
    await prisma.matricula.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.vinculoApoderado.deleteMany({ where: { estudiante: { personaId: { in: personas } } } });
    await prisma.usuario.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.estudiante.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.apoderado.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.docente.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.administrador.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.persona.deleteMany({ where: { id: { in: personas } } });
    await prisma.seccion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.parametroInstitucion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.anioAcademico.delete({ where: { id: anioId } });
    await prisma.$disconnect();
  }, ESPERA_PREPARACION);

  // ---------- Seguridad ----------

  it("401 sin sesión en la campana, el panel, el marcado y los recordatorios", async () => {
    for (const [manejador, ruta, metodo] of [
      [listarRuta, "/notificaciones", undefined],
      [noLeidasRuta, "/notificaciones/no-leidas", undefined],
      [marcarRuta, "/notificaciones/marcar-leidas", "POST"],
      [recordatoriosRuta, "/matricula/morosidad/recordatorios", "POST"],
    ] as const) {
      const r = await pedir(manejador, ruta, { metodo, cuerpo: metodo ? {} : undefined });
      expect(r.estado).toBe(401);
      expect(r.error?.code).toBe("NO_AUTENTICADO");
    }
  });

  it("403 al enviar recordatorios con el perfil Docente, Apoderado o Alumno", async () => {
    for (const t of [token.docente, token.apoderada, token.valeria]) {
      const r = await pedir(recordatoriosRuta, "/matricula/morosidad/recordatorios", {
        token: t,
        metodo: "POST",
        cuerpo: { matriculaIds: [matriculas.valeria] },
      });
      expect(r.estado).toBe(403);
    }
    expect(await prisma.notificacion.count({ where: { usuarioId: usuarios.apoderada } })).toBe(0);
  });

  it("valida la selección: vacía (400) o con una matrícula inexistente (404), sin enviar nada", async () => {
    const vacia = await pedir(recordatoriosRuta, "/matricula/morosidad/recordatorios", {
      token: token.admin,
      metodo: "POST",
      cuerpo: { matriculaIds: [] },
    });
    expect(vacia.estado).toBe(400);
    const ajena = await pedir(recordatoriosRuta, "/matricula/morosidad/recordatorios", {
      token: token.admin,
      metodo: "POST",
      cuerpo: { matriculaIds: [matriculas.valeria, ID_INEXISTENTE] },
    });
    expect(ajena.estado).toBe(404);
    expect(ajena.error?.code).toBe("MATRICULA_NO_ENCONTRADA");
    expect(
      (await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas.valeria } })).ultimoRecordatorioEn,
    ).toBeNull();
  });

  // ---------- US59 · Recordatorios de pago ----------

  it("envía solo a quien sigue con cuotas vencidas y tiene a quién avisar; guarda la fecha y la auditoría", async () => {
    correo.mockClear();
    const r = await enviarRecordatoriosPago(
      admin,
      { matriculaIds: [matriculas.valeria, matriculas.diego, matriculas.bruno] },
      meta,
    );
    expect(r).toMatchObject({ enviados: 1, omitidos: 2, correos: { registrados: 1, enviados: 1 } });
    const motivo = (id: string) => r.resultados.find((x) => x.matriculaId === id)?.motivo;
    expect(motivo(matriculas.valeria)).toBeNull();
    expect(motivo(matriculas.diego)).toBe("SIN_CUOTAS_VENCIDAS");
    expect(motivo(matriculas.bruno)).toBe("SIN_DESTINATARIO");

    const [valeria, diego, bruno] = await Promise.all(
      [matriculas.valeria, matriculas.diego, matriculas.bruno].map((id) =>
        prisma.matricula.findUniqueOrThrow({ where: { id } }),
      ),
    );
    expect(valeria.ultimoRecordatorioEn).not.toBeNull();
    expect(diego.ultimoRecordatorioEn).toBeNull();
    expect(bruno.ultimoRecordatorioEn).toBeNull();

    // notificación interna a la apoderada y correo con el detalle de la deuda
    const [n] = await prisma.notificacion.findMany({ where: { usuarioId: usuarios.apoderada, tipo: "RECORDATORIO" } });
    expect(n).toMatchObject({ titulo: "Recordatorio de pago", enlace: "/apoderado/pagos", leidaEn: null });
    expect(n.mensaje).toMatch(/^Valeria: 2 cuotas vencidas · S\/ 800\.00 · \d+ días de atraso$/);
    expect(correo).toHaveBeenCalledTimes(1);
    const enviado = correo.mock.calls[0][0];
    expect(enviado.para).toBe(emails.apoderada);
    expect(enviado.texto).toContain("2 cuotas vencidas por un total de S/ 800.00");
    expect(enviado.texto).toMatch(/· venció el 05\/01\/2026 · S\/ 400\.00 · \d+ días de atraso/);
    const [bandeja] = await correosDeApoderada();
    expect(bandeja).toMatchObject({ estado: "PROCESADO", intentos: 1, agregadoId: matriculas.valeria });

    const auditoria = await prisma.registroAuditoria.findMany({
      where: { accion: "ENVIAR_RECORDATORIOS", requestId: meta.requestId },
    });
    expect(auditoria.map((a) => a.entidadId)).toEqual([matriculas.valeria]);
    expect(auditoria[0].valorNuevo).toMatchObject({ deuda: "800.00", notificacion: true, correo: true });

    // la tabla de morosidad muestra la fecha del último recordatorio
    const panel = await panelMorosidad({ anioId, orden: "MONTO" });
    const fila = panel.items.find((x) => x.matriculaId === matriculas.valeria)!;
    expect(fila.ultimoRecordatorio).toBe(valeria.ultimoRecordatorioEn!.toISOString());
    expect(panel.items.find((x) => x.matriculaId === matriculas.bruno)!.ultimoRecordatorio).toBeNull();
  });

  it("por la API, el administrador recibe cuántos se enviaron y cuántos se omitieron", async () => {
    // sin nadie a quien enviar: no se audita nada a nombre de la administradora de prueba
    const r = await pedir(recordatoriosRuta, "/matricula/morosidad/recordatorios", {
      token: token.admin,
      metodo: "POST",
      cuerpo: { matriculaIds: [matriculas.diego, matriculas.bruno] },
    });
    expect(r.estado).toBe(200);
    expect(r.datos).toMatchObject({ enviados: 0, omitidos: 2 });
    expect(r.datos.resultados.map((x: { motivo: string }) => x.motivo).sort()).toEqual([
      "SIN_CUOTAS_VENCIDAS",
      "SIN_DESTINATARIO",
    ]);
  });

  it("el pago confirmado en Tesorería notifica a la apoderada en la misma transacción", async () => {
    const cuota = await prisma.conceptoCobro.findFirstOrThrow({
      where: { matriculaId: matriculas.diego, tipo: "MATRICULA" },
    });
    const r = await registrarPago(
      admin,
      {
        conceptoIds: [cuota.id],
        monto: "300.00",
        medioPago: "TRANSFERENCIA",
        numeroOperacion: `NOTIF-${Date.now()}`,
        fechaPago: new Date().toISOString().slice(0, 10),
      },
      meta,
    );
    const pago = await prisma.notificacion.findFirstOrThrow({ where: { usuarioId: usuarios.apoderada, tipo: "PAGO" } });
    expect(pago).toMatchObject({ titulo: "Pago registrado", enlace: "/apoderado/pagos" });
    expect(pago.mensaje).toContain(`Diego · `);
    expect(pago.mensaje).toContain(`Recibo ${r.operacion.comprobante?.numero}`);
  });

  // ---------- US55 · Campana y panel ----------

  it("la campana cuenta las no leídas y el panel muestra solo las del usuario en sesión", async () => {
    const contador = await pedir(noLeidasRuta, "/notificaciones/no-leidas", { token: token.apoderada });
    expect(contador.datos).toEqual({ noLeidas: 2 });
    const panel = await pedir(listarRuta, "/notificaciones", { token: token.apoderada });
    expect(panel.datos.noLeidas).toBe(2);
    expect(panel.datos.items).toHaveLength(2);
    // la más reciente primero: el pago, luego el recordatorio
    expect(panel.datos.items.map((x: { tipo: string }) => x.tipo)).toEqual(["PAGO", "RECORDATORIO"]);
    expect(panel.datos.items[1]).toMatchObject({ leida: false, enlace: "/apoderado/pagos" });

    // la docente no ve las notificaciones de la apoderada
    const ajeno = await pedir(listarRuta, "/notificaciones", { token: token.docente });
    expect(ajeno.datos).toEqual({ noLeidas: 0, items: [] });
  });

  it("nadie marca una notificación ajena: 404 y la notificación sigue sin leer", async () => {
    const [n] = await prisma.notificacion.findMany({ where: { usuarioId: usuarios.apoderada } });
    const r = await pedir(marcarRuta, "/notificaciones/marcar-leidas", {
      token: token.docente,
      metodo: "POST",
      cuerpo: { ids: [n.id] },
    });
    expect(r.estado).toBe(404);
    expect(r.error?.code).toBe("NOTIFICACION_NO_ENCONTRADA");
    expect((await prisma.notificacion.findUniqueOrThrow({ where: { id: n.id } })).leidaEn).toBeNull();
    // marcar «todas» como la docente no toca las de la apoderada
    const todas = await pedir(marcarRuta, "/notificaciones/marcar-leidas", {
      token: token.docente,
      metodo: "POST",
      cuerpo: {},
    });
    expect(todas.datos).toEqual({ marcadas: 0, noLeidas: 0 });
    expect(await prisma.notificacion.count({ where: { usuarioId: usuarios.apoderada, leidaEn: null } })).toBe(2);
  });

  it("«Marcar como leídas»: una al abrirla y luego todas; el indicador se actualiza", async () => {
    const [primera] = await prisma.notificacion.findMany({ where: { usuarioId: usuarios.apoderada } });
    const una = await pedir(marcarRuta, "/notificaciones/marcar-leidas", {
      token: token.apoderada,
      metodo: "POST",
      cuerpo: { ids: [primera.id] },
    });
    expect(una.datos).toEqual({ marcadas: 1, noLeidas: 1 });
    const noLeidas = await pedir(listarRuta, "/notificaciones?estado=no-leidas", { token: token.apoderada });
    expect(noLeidas.datos.items.map((x: { id: string }) => x.id)).not.toContain(primera.id);

    const todas = await pedir(marcarRuta, "/notificaciones/marcar-leidas", {
      token: token.apoderada,
      metodo: "POST",
      cuerpo: {},
    });
    expect(todas.datos).toEqual({ marcadas: 1, noLeidas: 0 });
    const vacio = await pedir(listarRuta, "/notificaciones?estado=no-leidas", { token: token.apoderada });
    expect(vacio.datos).toEqual({ noLeidas: 0, items: [] });
  });

  // ---------- US55 criterio 3 · Reintento del correo ----------

  it("si el correo falla, el recordatorio se conserva y el correo queda pendiente; se reintenta hasta 5 veces", async () => {
    await prisma.outboxEvento.deleteMany({
      where: { tipoEvento: "CORREO", payload: { path: ["para"], equals: emails.apoderada } },
    });
    correo.mockResolvedValue(false);
    const antes = new Date();
    const r = await enviarRecordatoriosPago(admin, { matriculaIds: [matriculas.valeria] }, meta);
    // la operación no se revierte ni se bloquea: el recordatorio cuenta como enviado y la fecha se guarda
    expect(r).toMatchObject({ enviados: 1, correos: { registrados: 1, enviados: 0 } });
    const m = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas.valeria } });
    expect(m.ultimoRecordatorioEn!.getTime()).toBeGreaterThanOrEqual(antes.getTime() - 1000);

    let [fila] = await correosDeApoderada();
    expect(fila).toMatchObject({ estado: "PENDIENTE", intentos: 1 });
    expect(fila.ultimoError).toContain("no aceptó el envío");
    const espera = fila.proximoIntento!.getTime() - antes.getTime();
    expect(espera).toBeGreaterThan(4 * 60_000);
    expect(espera).toBeLessThan(6 * 60_000);

    // el job lo toma cuando llega su próximo intento; tras el quinto fallo queda FALLIDO
    for (let intento = 2; intento <= 5; intento++) {
      await prisma.outboxEvento.update({
        where: { id: fila.id },
        data: { proximoIntento: new Date(Date.now() - 1000) },
      });
      await procesarBandeja();
      fila = await prisma.outboxEvento.findUniqueOrThrow({ where: { id: fila.id } });
      expect(fila.intentos).toBe(intento);
      expect(fila.estado).toBe(intento < 5 ? "PENDIENTE" : "FALLIDO");
    }
    await prisma.outboxEvento.update({ where: { id: fila.id }, data: { proximoIntento: new Date(Date.now() - 1000) } });
    await procesarBandeja();
    expect((await prisma.outboxEvento.findUniqueOrThrow({ where: { id: fila.id } })).intentos).toBe(5);
  });

  it("un correo pendiente se envía en el reintento siguiente y queda PROCESADO", async () => {
    await prisma.outboxEvento.deleteMany({
      where: { tipoEvento: "CORREO", payload: { path: ["para"], equals: emails.apoderada } },
    });
    correo.mockResolvedValueOnce(false);
    await enviarRecordatoriosPago(admin, { matriculaIds: [matriculas.valeria] }, meta);
    const [fila] = await correosDeApoderada();
    expect(fila.estado).toBe("PENDIENTE");

    correo.mockResolvedValue(true);
    // antes de su próximo intento, el job no lo toca
    await procesarBandeja();
    expect((await prisma.outboxEvento.findUniqueOrThrow({ where: { id: fila.id } })).intentos).toBe(1);
    await prisma.outboxEvento.update({ where: { id: fila.id }, data: { proximoIntento: new Date(Date.now() - 1000) } });
    await procesarBandeja();
    const final = await prisma.outboxEvento.findUniqueOrThrow({ where: { id: fila.id } });
    expect(final).toMatchObject({ estado: "PROCESADO", intentos: 2, ultimoError: null });
    expect(final.procesadoEn).not.toBeNull();
  });
});
