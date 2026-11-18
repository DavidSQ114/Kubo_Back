// Prueba de integración (US69): editar el correo de una persona con cuenta cambia el correo de acceso en la misma
// transacción, cierra sus sesiones y deja la auditoría; además, la baja elimina o desactiva según sus registros.
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/comunidad/edicionPersonas
// Crea sus propias personas ficticias y las borra al terminar (la bitácora es inmutable y se conserva).
import "@/server/wiring";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/platform/auth/tokens";
import { prisma } from "@/platform/db/prisma";
import { detallePersona, editarPersona, eliminarPersona, historialPersona } from "@/modules/comunidad";
import { iniciarSesion, renovarSesion, requerirSesion, type Autenticado } from "@/modules/identidad";

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
const meta = { requestId: "prueba-editar-persona", ip: null, userAgent: null };
const PASSWORD = "Prueba-US69-2026";
const CORREO_MAL = "rosa.us69@corre.test";
const CORREO_BIEN = "rosa.us69@correo.test";
const CORREO_OTRA = "otra.us69@correo.test";
const DNIS = ["90000691", "90000692", "90000693", "90000694"];

const conToken = (acceso: string) =>
  new NextRequest("http://localhost/api/v1/prueba", { headers: { authorization: `Bearer ${acceso}` } });

describe.skipIf(!ACTIVA)("editar y dar de baja personas (US69)", () => {
  let admin: Autenticado;
  let rosaId: string;
  let otraId: string;
  let sinUsoId: string;

  async function crearApoderada(dni: string, nombres: string, email: string) {
    const p = await prisma.persona.create({
      data: {
        dni,
        nombres,
        apellidos: "Prueba Edición",
        email,
        telefono: "987654321",
        direccion: "Jr. Ficticio 123",
        fechaNacimiento: new Date("1980-05-10T00:00:00Z"),
        apoderado: { create: { ocupacion: "Enfermera" } },
        usuario: {
          create: { email, passwordHash: await hashPassword(PASSWORD), estado: "ACTIVO", debeCambiarPassword: false },
        },
      },
    });
    return p.id;
  }

  async function ingresar(email: string) {
    const r = await iniciarSesion({ email, password: PASSWORD, recordar: false }, meta);
    if (r.tipo !== "SESION") throw new Error("Se esperaba una sesión con un solo perfil");
    return r.tokens;
  }

  beforeAll(async () => {
    vi.stubEnv("JWT_SECRET", "secreto-de-prueba-solo-para-vitest-0123456789");
    const u = await prisma.usuario.findFirstOrThrow({ where: { email: "admin@kubo.edu.pe" } });
    admin = {
      usuarioId: u.id,
      sesionId: "prueba",
      personaId: u.personaId,
      email: u.email,
      rol: "ADMINISTRADOR",
      debeCambiarPassword: false,
    };
    rosaId = await crearApoderada(DNIS[0], "Rosa", CORREO_MAL);
    otraId = await crearApoderada(DNIS[1], "Otra", CORREO_OTRA);
    sinUsoId = await crearApoderada(DNIS[2], "Sin Uso", "sinuso.us69@correo.test");
  });

  afterAll(async () => {
    const donde = { persona: { dni: { in: DNIS } } };
    await prisma.usuario.deleteMany({ where: donde });
    await prisma.apoderado.deleteMany({ where: donde });
    await prisma.persona.deleteMany({ where: { dni: { in: DNIS } } });
    await prisma.$disconnect();
    vi.unstubAllEnvs();
  });

  it("cambia el correo de la cuenta, cierra las sesiones abiertas y avisa a ambos correos", async () => {
    const tokens = await ingresar(CORREO_MAL);
    await expect(requerirSesion(conToken(tokens.acceso))).resolves.toMatchObject({ personaId: rosaId });
    const antes = await prisma.usuario.findUniqueOrThrow({ where: { personaId: rosaId } });

    const r = await editarPersona(admin, rosaId, { email: CORREO_BIEN }, meta);
    expect(r).toMatchObject({ cambios: ["email"], sesionesCerradas: true, avisos: { nuevo: true, anterior: true } });

    const despues = await prisma.usuario.findUniqueOrThrow({ where: { personaId: rosaId } });
    expect(despues.email).toBe(CORREO_BIEN);
    expect(despues.versionSesion).toBe(antes.versionSesion + 1);
    expect((await prisma.persona.findUniqueOrThrow({ where: { id: rosaId } })).email).toBe(CORREO_BIEN);
    expect(await prisma.sesion.count({ where: { usuarioId: despues.id, revocadaEn: null } })).toBe(0);

    // El token de acceso y el de refresco anteriores dejan de valer de inmediato.
    await expect(requerirSesion(conToken(tokens.acceso))).rejects.toMatchObject({ codigo: "SESION_INVALIDA" });
    await expect(renovarSesion(tokens.refresh)).rejects.toMatchObject({ codigo: "SESION_INVALIDA" });
    // Ya no ingresa con el correo mal escrito; sí con el corregido y la misma contraseña.
    await expect(iniciarSesion({ email: CORREO_MAL, password: PASSWORD, recordar: false }, meta)).rejects.toMatchObject(
      { codigo: "CREDENCIALES_INVALIDAS" },
    );
    await expect(ingresar(CORREO_BIEN)).resolves.toMatchObject({ recordar: false });
  });

  it("deja la auditoría EDITAR_PERSONA con el valor anterior y el nuevo, y la muestra en el historial", async () => {
    const fila = await prisma.registroAuditoria.findFirstOrThrow({
      where: { entidadAfectada: "persona", entidadId: rosaId, accion: "EDITAR_PERSONA" },
      orderBy: { createdAt: "desc" },
    });
    expect(fila.usuarioId).toBe(admin.usuarioId);
    expect(fila.valorAnterior).toEqual({ email: CORREO_MAL });
    expect(fila.valorNuevo).toEqual({ email: CORREO_BIEN });
    // La bitácora es inmutable (tg_auditoria_inmutable).
    await expect(
      prisma.registroAuditoria.update({ where: { id: fila.id }, data: { motivo: "alterado" } }),
    ).rejects.toThrow();

    const { items } = await historialPersona(rosaId);
    expect(items[0]).toMatchObject({
      accion: "EDITAR_PERSONA",
      cambios: [{ campo: "email", anterior: CORREO_MAL, nuevo: CORREO_BIEN }],
    });
    expect(items[0].responsable).toBeTruthy();
  });

  it("edita el sexo de una apoderada (no solo de estudiantes) y lo deja en la auditoría", async () => {
    const r = await editarPersona(admin, otraId, { sexo: "FEMENINO" }, meta);
    expect(r).toMatchObject({ cambios: ["sexo"], sesionesCerradas: false });
    expect((await prisma.persona.findUniqueOrThrow({ where: { id: otraId } })).sexo).toBe("FEMENINO");
    const fila = await prisma.registroAuditoria.findFirstOrThrow({
      where: { entidadAfectada: "persona", entidadId: otraId, accion: "EDITAR_PERSONA" },
      orderBy: { createdAt: "desc" },
    });
    expect(fila.valorAnterior).toEqual({ sexo: null });
    expect(fila.valorNuevo).toEqual({ sexo: "FEMENINO" });
    expect((await detallePersona(otraId)).sexo).toBe("FEMENINO");
  });

  it("rechaza un correo que ya es de otra cuenta sin cambiar nada (409 EMAIL_EN_USO)", async () => {
    const antes = await prisma.usuario.findUniqueOrThrow({ where: { personaId: rosaId } });
    await expect(editarPersona(admin, rosaId, { email: CORREO_OTRA }, meta)).rejects.toMatchObject({
      codigo: "EMAIL_EN_USO",
      estadoHttp: 409,
      message: "Ese correo ya está registrado en otra cuenta.",
    });
    const despues = await prisma.usuario.findUniqueOrThrow({ where: { personaId: rosaId } });
    expect(despues.email).toBe(CORREO_BIEN);
    expect(despues.versionSesion).toBe(antes.versionSesion);
  });

  it("cambia el DNI solo con motivo, no acepta uno existente y lo enmascara en la auditoría", async () => {
    await expect(editarPersona(admin, rosaId, { dni: DNIS[3] }, meta)).rejects.toMatchObject({
      codigo: "MOTIVO_REQUERIDO",
    });
    await expect(
      editarPersona(admin, rosaId, { dni: DNIS[1], motivo: "DNI mal digitado" }, meta),
    ).rejects.toMatchObject({ codigo: "DNI_YA_REGISTRADO", estadoHttp: 409 });

    const r = await editarPersona(admin, rosaId, { dni: DNIS[3], motivo: "DNI mal digitado" }, meta);
    expect(r).toMatchObject({ cambios: ["dni"], sesionesCerradas: false, avisos: null });
    expect((await detallePersona(rosaId)).dni).toBe(DNIS[3]);
    const fila = await prisma.registroAuditoria.findFirstOrThrow({
      where: { entidadAfectada: "persona", entidadId: rosaId, accion: "EDITAR_PERSONA" },
      orderBy: { createdAt: "desc" },
    });
    expect(fila.valorAnterior).toEqual({ dni: "******91" });
    expect(fila.valorNuevo).toEqual({ dni: "******94" });
    expect(fila.motivo).toBe("DNI mal digitado");
  });

  it("sin cambios no escribe en la bitácora", async () => {
    const contar = () => prisma.registroAuditoria.count({ where: { entidadAfectada: "persona", entidadId: otraId } });
    const antes = await contar();
    const r = await editarPersona(admin, otraId, { email: CORREO_OTRA, telefono: "987654321" }, meta);
    expect(r.cambios).toEqual([]);
    expect(await contar()).toBe(antes);
  });

  it("al dar de baja a quien ya usó su cuenta, desactiva su perfil y cierra sus sesiones", async () => {
    const tokens = await ingresar(CORREO_BIEN);
    const r = await eliminarPersona(admin, rosaId, {}, meta);
    expect(r).toMatchObject({
      resultado: "PERFIL_DESACTIVADO",
      perfiles: ["APODERADO"],
      motivos: ["ya ingresó al sistema con su cuenta"],
    });
    expect((await prisma.apoderado.findUniqueOrThrow({ where: { personaId: rosaId } })).activo).toBe(false);
    await expect(requerirSesion(conToken(tokens.acceso))).rejects.toMatchObject({ codigo: "SESION_INVALIDA" });
    expect((await historialPersona(rosaId)).items[0]).toMatchObject({
      accion: "DESACTIVAR_PERFIL",
      perfil: "APODERADO",
    });
  });

  it("elimina a la persona sin registros junto con su cuenta sin usar, y lo deja en la auditoría", async () => {
    const r = await eliminarPersona(admin, sinUsoId, {}, meta);
    expect(r.resultado).toBe("ELIMINADA");
    expect(await prisma.persona.count({ where: { id: sinUsoId } })).toBe(0);
    expect(await prisma.usuario.count({ where: { personaId: sinUsoId } })).toBe(0);
    const fila = await prisma.registroAuditoria.findFirstOrThrow({
      where: { entidadAfectada: "persona", entidadId: sinUsoId, accion: "ELIMINAR_PERSONA" },
    });
    expect(fila.valorAnterior).toMatchObject({ dni: "******93", perfiles: ["APODERADO"], cuentaEliminada: true });
  });

  it("nadie elimina su propio registro", async () => {
    await expect(eliminarPersona(admin, admin.personaId, {}, meta)).rejects.toMatchObject({
      codigo: "OPERACION_NO_PERMITIDA",
    });
  });
});
