// Prueba de integración (bloque M1, fase 4): herramientas del Administrador. Desbloquear una cuenta bloqueada por
// intentos fallidos (AD-06), parámetros del sistema con validación por tipo y la bitácora de operaciones auditadas;
// el Coordinador académico recibe 403 en parámetros y auditoría.
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/identidad/administracion
// Crea sus propios datos ficticios con DNI 900022xx y los borra al terminar. Las operaciones auditadas las firma el
// administrador del seed (quien queda como actor en registro_auditoria ya no se puede borrar).
import "@/server/wiring";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "@/platform/auth/tokens";
import { prisma } from "@/platform/db/prisma";
import { PUT as actualizarParametroRuta } from "@/app/api/v1/academico/parametros/[clave]/route";
import { GET as parametrosRuta } from "@/app/api/v1/academico/parametros/route";
import { GET as auditoriaRuta } from "@/app/api/v1/identidad/auditoria/route";
import { POST as desbloquearRuta } from "@/app/api/v1/identidad/usuarios/[id]/desbloquear/route";
import { actualizarParametroSistema } from "@/modules/academico";
import { listarUsuarios } from "@/modules/comunidad";
import { desbloquearUsuario, type Autenticado } from "@/modules/identidad";
import { borrarCuentasDePrueba, crearSesionAdministrador, crearSesionCoordinador, pedir } from "../ayudantes/sesiones";

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
const CLAVE = "Prueba-Kubo-M1-Admin";
const meta = { requestId: `prueba-administracion-${Date.now()}`, ip: null, userAgent: null };
const ESPERA_PREPARACION = 120_000;
const ESPERA = 30_000;

describe.skipIf(!ACTIVA)("herramientas del Administrador: desbloquear, parámetros y auditoría (bloque M1)", () => {
  const personas: string[] = [];
  const token = { admin: "", coordinador: "" };
  let admin: Autenticado;
  let bloqueada: { personaId: string; usuarioId: string };
  let umbralOriginal: unknown;

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
    const a = await crearSesionAdministrador("90002201", CLAVE);
    const c = await crearSesionCoordinador("90002202", CLAVE);
    personas.push(a.personaId, c.personaId);
    token.admin = a.token;
    token.coordinador = c.token;

    // apoderada con la cuenta bloqueada 15 minutos por intentos fallidos
    const p = await prisma.persona.create({
      data: {
        dni: "90002203",
        nombres: "Lucía",
        apellidos: "Bloqueada Prueba",
        email: "90002203@prueba.kubo.test",
        apoderado: { create: {} },
      },
    });
    const usuario = await prisma.usuario.create({
      data: {
        personaId: p.id,
        email: "90002203@prueba.kubo.test",
        passwordHash: await hashPassword(CLAVE),
        estado: "ACTIVO",
        debeCambiarPassword: false,
        intentosFallidos: 0,
        bloqueadoHasta: new Date(Date.now() + 15 * 60_000),
      },
    });
    bloqueada = { personaId: p.id, usuarioId: usuario.id };
    umbralOriginal = (
      await prisma.parametroInstitucion.findFirst({ where: { clave: "UMBRAL_FALTAS_MES", anioAcademicoId: null } })
    )?.valor;
  }, ESPERA_PREPARACION);

  afterAll(async () => {
    if (umbralOriginal !== undefined) {
      await prisma.parametroInstitucion.updateMany({
        where: { clave: "UMBRAL_FALTAS_MES", anioAcademicoId: null },
        data: { valor: umbralOriginal as number },
      });
    }
    if (bloqueada) {
      await prisma.usuario.deleteMany({ where: { id: bloqueada.usuarioId } });
      await prisma.apoderado.deleteMany({ where: { personaId: bloqueada.personaId } });
      await prisma.persona.deleteMany({ where: { id: bloqueada.personaId } });
    }
    await borrarCuentasDePrueba(personas);
    await prisma.$disconnect();
  }, ESPERA_PREPARACION);

  it("AD-06 marca la cuenta «Bloqueada por intentos» en el listado", { timeout: ESPERA }, async () => {
    const r = await listarUsuarios({ q: "90002203", pagina: 1, tamano: 5 });
    expect(r.items).toHaveLength(1);
    expect(r.items[0].bloqueadaPorIntentos).toBe(true);
    expect(r.items[0].estado).toBe("ACTIVO");
  });

  it(
    "el coordinador no desbloquea (403) y desbloquear deja los intentos en 0 con auditoría",
    { timeout: ESPERA },
    async () => {
      const rechazo = await pedir(desbloquearRuta, "/identidad/usuarios/…/desbloquear", {
        token: token.coordinador,
        params: { id: bloqueada.usuarioId },
        cuerpo: {},
      });
      expect(rechazo.estado).toBe(403);

      const r = await desbloquearUsuario(admin, bloqueada.usuarioId, { motivo: "Verificó su identidad" }, meta);
      expect(r).toEqual({ usuarioId: bloqueada.usuarioId, intentosFallidos: 0, bloqueadoHasta: null });
      const u = await prisma.usuario.findUniqueOrThrow({ where: { id: bloqueada.usuarioId } });
      expect(u.bloqueadoHasta).toBeNull();
      expect(u.intentosFallidos).toBe(0);
      expect(u.estado).toBe("ACTIVO"); // no es reactivar: el estado no cambia
      const evento = await prisma.registroAuditoria.findFirstOrThrow({
        where: { accion: "DESBLOQUEAR_USUARIO", entidadId: bloqueada.usuarioId, requestId: meta.requestId },
      });
      expect(evento.motivo).toBe("Verificó su identidad");
      expect(evento.valorNuevo).toEqual({ intentosFallidos: 0, bloqueadoHasta: null });
    },
  );

  it("una cuenta que ya no está bloqueada responde 409 USUARIO_NO_BLOQUEADO", { timeout: ESPERA }, async () => {
    const r = await pedir(desbloquearRuta, "/identidad/usuarios/…/desbloquear", {
      token: token.admin,
      params: { id: bloqueada.usuarioId },
      cuerpo: {},
    });
    expect(r.estado).toBe(409);
    expect(r.error?.code).toBe("USUARIO_NO_BLOQUEADO");
  });

  it("parámetros: el administrador los lista; el coordinador recibe 403", { timeout: ESPERA }, async () => {
    const lista = await pedir(parametrosRuta, "/academico/parametros", { token: token.admin });
    expect(lista.estado).toBe(200);
    const claves = (lista.datos as { clave: string }[]).map((p) => p.clave);
    expect(claves).toContain("MAX_INTENTOS_LOGIN");
    expect(claves).not.toContain("BLOQUES_HORARIO");
    expect((await pedir(parametrosRuta, "/academico/parametros", { token: token.coordinador })).estado).toBe(403);
    const cambio = await pedir(actualizarParametroRuta, "/academico/parametros/…", {
      token: token.coordinador,
      params: { clave: "UMBRAL_FALTAS_MES" },
      metodo: "PUT",
      cuerpo: { valor: "4" },
    });
    expect(cambio.estado).toBe(403);
  });

  it(
    "un valor que no corresponde al tipo responde 400 PARAMETRO_INVALIDO con un mensaje claro",
    { timeout: ESPERA },
    async () => {
      const casos: [string, string, RegExp][] = [
        ["MAX_INTENTOS_LOGIN", "4.5", /entero entre 3 y 10/],
        ["HORA_LIMITE_ASISTENCIA_DOCENTE", "8 am", /HH:MM/],
        ["UMBRAL_INASISTENCIA", "20", /mayor que 0 y menor que 1/],
        ["MONTO_PENSION", "-5", /monto mayor a 0/],
      ];
      for (const [clave, valor, mensaje] of casos) {
        const r = await pedir(actualizarParametroRuta, "/academico/parametros/…", {
          token: token.admin,
          params: { clave },
          metodo: "PUT",
          cuerpo: { valor },
        });
        expect(r.estado).toBe(400);
        expect(r.error?.code).toBe("PARAMETRO_INVALIDO");
        expect(r.error?.message).toMatch(mensaje);
      }
    },
  );

  it("actualizar un parámetro guarda el valor nuevo y audita el anterior", { timeout: ESPERA }, async () => {
    const r = await actualizarParametroSistema(admin, "UMBRAL_FALTAS_MES", { valor: "4" }, meta);
    expect(r.valor).toBe("4");
    const fila = await prisma.parametroInstitucion.findFirstOrThrow({
      where: { clave: "UMBRAL_FALTAS_MES", anioAcademicoId: null },
    });
    expect(fila.valor).toBe(4);
    const evento = await prisma.registroAuditoria.findFirstOrThrow({
      where: { accion: "ACTUALIZAR_PARAMETRO", entidadId: fila.id, requestId: meta.requestId },
    });
    expect(evento.valorAnterior).toEqual({ clave: "UMBRAL_FALTAS_MES", valor: umbralOriginal ?? null });
    expect(evento.valorNuevo).toEqual({ clave: "UMBRAL_FALTAS_MES", valor: 4 });
  });

  it("auditoría: el administrador ve las operaciones; el coordinador recibe 403", { timeout: ESPERA }, async () => {
    const r = await pedir(auditoriaRuta, "/identidad/auditoria?accion=DESBLOQUEAR_USUARIO", { token: token.admin });
    expect(r.estado).toBe(200);
    expect(r.datos.items.some((i: { entidadId: string }) => i.entidadId === bloqueada.usuarioId)).toBe(true);
    expect(r.datos.acciones).toContain("ACTUALIZAR_PARAMETRO");
    expect((await pedir(auditoriaRuta, "/identidad/auditoria", { token: token.coordinador })).estado).toBe(403);
  });
});
