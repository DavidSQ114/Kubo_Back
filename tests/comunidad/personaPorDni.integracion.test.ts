// Prueba de integración del bloque M5: GET /comunidad/personas?dni= devuelve, además de nombres, perfiles y cuenta, los
// datos personales ya registrados (fecha de nacimiento, sexo, teléfono y dirección) y la ocupación del perfil
// Apoderado activo, para que los formularios de registro los muestren. Solo Administrador y Coordinador académico.
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/comunidad/personaPorDni
// Crea sus propios datos ficticios (DNI 900028xx) y los borra al terminar. Solo lee: no deja auditoría.
import "@/server/wiring";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "@/platform/auth/tokens";
import { prisma } from "@/platform/db/prisma";
import { GET as personasRuta } from "@/app/api/v1/comunidad/personas/route";
import { iniciarSesion } from "@/modules/identidad";
import {
  borrarCuentasDePrueba,
  crearSesionAdministrador,
  crearSesionCoordinador,
  pedir,
  type CuentaDePrueba,
} from "../ayudantes/sesiones";

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
// contraseña ficticia de las cuentas que crea la prueba (cumple la política; no es de ninguna cuenta real)
const CLAVE = "Prueba-Kubo-2028";
const DNI_APODERADA = "90002801";
const DNI_SIN_DATOS = "90002802";
const DNI_APODERADO_INACTIVO = "90002803";

describe.skipIf(!ACTIVA)("persona por DNI con sus datos registrados (bloque M5)", () => {
  let coordinador: CuentaDePrueba;
  let administrador: CuentaDePrueba;
  let tokenDocente = "";
  const personas: string[] = [];

  beforeAll(async () => {
    process.env.JWT_SECRET ??= "clave-de-firma-solo-para-pruebas-de-integracion";
    coordinador = await crearSesionCoordinador("90002810", CLAVE);
    administrador = await crearSesionAdministrador("90002811", CLAVE);
    const apoderada = await prisma.persona.create({
      data: {
        dni: DNI_APODERADA,
        nombres: "Marta Elena",
        apellidos: "Prueba Ríos",
        email: "marta.prueba@prueba.kubo.test",
        fechaNacimiento: new Date("1984-03-09T00:00:00Z"),
        sexo: "FEMENINO",
        telefono: "987654321",
        direccion: "Jr. Prueba 123, Lima",
        apoderado: { create: { ocupacion: "Contadora" } },
      },
    });
    const sinDatos = await prisma.persona.create({
      data: { dni: DNI_SIN_DATOS, nombres: "Pedro", apellidos: "Prueba Sin Datos", docente: { create: {} } },
    });
    const inactivo = await prisma.persona.create({
      data: {
        dni: DNI_APODERADO_INACTIVO,
        nombres: "Luis",
        apellidos: "Prueba Inactivo",
        apoderado: { create: { ocupacion: "Chofer", activo: false } },
      },
    });
    personas.push(apoderada.id, sinDatos.id, inactivo.id);
    // la persona sin datos es docente con cuenta: su sesión no puede consultar personas
    const email = `${DNI_SIN_DATOS}@prueba.kubo.test`;
    await prisma.usuario.create({
      data: {
        personaId: sinDatos.id,
        email,
        passwordHash: await hashPassword(CLAVE),
        estado: "ACTIVO",
        debeCambiarPassword: false,
      },
    });
    const meta = { requestId: `prueba-persona-dni-${Date.now()}`, ip: null, userAgent: null };
    const s = await iniciarSesion({ email, password: CLAVE, recordar: false }, meta);
    if (s.tipo === "SESION") tokenDocente = s.tokens.acceso;
  }, 60_000);

  afterAll(async () => {
    await prisma.apoderado.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.docente.deleteMany({ where: { personaId: { in: personas } } });
    // sesiones, usuarios, perfiles de gestión y personas (también la del docente con cuenta)
    await borrarCuentasDePrueba(
      [...personas, coordinador?.personaId, administrador?.personaId].filter(Boolean) as string[],
    );
    await prisma.$disconnect();
  }, 60_000);

  const consultar = (dni: string, token?: string) => pedir(personasRuta, `/comunidad/personas?dni=${dni}`, { token });

  it("devuelve la fecha de nacimiento, el sexo, el teléfono, la dirección y la ocupación del apoderado", async () => {
    const r = await consultar(DNI_APODERADA, coordinador.token);
    expect(r.estado).toBe(200);
    expect(r.datos).toMatchObject({
      dni: DNI_APODERADA,
      nombres: "Marta Elena",
      apellidos: "Prueba Ríos",
      email: "marta.prueba@prueba.kubo.test",
      perfiles: ["APODERADO"],
      tieneCuenta: false,
      fechaNacimiento: "1984-03-09",
      sexo: "FEMENINO",
      telefono: "987654321",
      direccion: "Jr. Prueba 123, Lima",
      ocupacion: "Contadora",
    });
  });

  it("sin datos registrados responde null en cada campo, y sin perfil Apoderado activo no da ocupación", async () => {
    const sinDatos = await consultar(DNI_SIN_DATOS, administrador.token);
    expect(sinDatos.datos).toMatchObject({
      perfiles: ["DOCENTE"],
      fechaNacimiento: null,
      sexo: null,
      telefono: null,
      direccion: null,
      ocupacion: null,
    });
    const inactivo = await consultar(DNI_APODERADO_INACTIVO, coordinador.token);
    expect(inactivo.datos).toMatchObject({ perfiles: [], ocupacion: null });
  });

  it("un DNI nuevo responde null; sin sesión o con la de un docente se rechaza (solo Administrador y Coordinador)", async () => {
    expect((await consultar("90002899", coordinador.token)).datos).toBeNull();
    expect((await consultar(DNI_APODERADA)).estado).toBe(401);
    expect(tokenDocente).not.toBe("");
    const docente = await consultar(DNI_APODERADA, tokenDocente);
    expect(docente).toMatchObject({ estado: 403, error: { code: "ACCESO_DENEGADO" } });
  });
});
