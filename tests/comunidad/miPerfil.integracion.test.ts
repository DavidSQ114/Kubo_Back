// Prueba de integración (bloque M1, fase 5): «Mi perfil». Cada usuario ve sus datos con el DNI enmascarado y cambia
// solo su teléfono y su dirección (auditoría ACTUALIZAR_PERFIL); el correo y el DNI se rechazan; sin sesión, 401.
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/comunidad/miPerfil
// Crea sus propios datos ficticios con DNI 900023xx y los borra al terminar. El cambio auditado lo hace el
// administrador del seed sobre su propio perfil (y lo devuelve a su valor): quien queda como actor en
// registro_auditoria ya no se puede borrar.
import "@/server/wiring";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/platform/db/prisma";
import { GET as miPerfilRuta, PATCH as actualizarRuta } from "@/app/api/v1/comunidad/mi-perfil/route";
import { actualizarMiPerfil, miPerfil } from "@/modules/comunidad";
import type { Autenticado } from "@/modules/identidad";
import { borrarCuentasDePrueba, crearSesionCoordinador, pedir } from "../ayudantes/sesiones";

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
const CLAVE = "Prueba-Kubo-M1-Perfil";
const meta = { requestId: `prueba-mi-perfil-${Date.now()}`, ip: null, userAgent: null };
const ESPERA_PREPARACION = 120_000;
const ESPERA = 30_000;

describe.skipIf(!ACTIVA)("Mi perfil (bloque M1)", () => {
  const personas: string[] = [];
  let token = "";
  let admin: Autenticado;
  let telefonoOriginal: string | null = null;

  beforeAll(async () => {
    process.env.JWT_SECRET ??= "clave-de-firma-solo-para-pruebas-de-integracion";
    const c = await crearSesionCoordinador("90002301", CLAVE);
    personas.push(c.personaId);
    token = c.token;
    const u = await prisma.usuario.findFirstOrThrow({ where: { email: "admin@kubo.edu.pe" } });
    admin = {
      usuarioId: u.id,
      sesionId: "prueba",
      personaId: u.personaId,
      email: u.email,
      rol: "ADMINISTRADOR",
      debeCambiarPassword: false,
    };
    telefonoOriginal = (await prisma.persona.findUniqueOrThrow({ where: { id: u.personaId } })).telefono;
  }, ESPERA_PREPARACION);

  afterAll(async () => {
    if (admin) await prisma.persona.update({ where: { id: admin.personaId }, data: { telefono: telefonoOriginal } });
    await borrarCuentasDePrueba(personas);
    await prisma.$disconnect();
  }, ESPERA_PREPARACION);

  it("sin sesión responde 401", { timeout: ESPERA }, async () => {
    expect((await pedir(miPerfilRuta, "/comunidad/mi-perfil")).estado).toBe(401);
  });

  it("muestra nombres, DNI enmascarado, correo, roles y último ingreso", { timeout: ESPERA }, async () => {
    const r = await pedir(miPerfilRuta, "/comunidad/mi-perfil", { token });
    expect(r.estado).toBe(200);
    expect(r.datos).toMatchObject({
      nombreCompleto: "Carmen Coordinadora Prueba",
      dni: "******01",
      email: "90002301@prueba.kubo.test",
      roles: ["COORDINADOR"],
      rolActivo: "COORDINADOR",
    });
    expect(r.datos.ultimoAccesoEn).not.toBeNull();
    expect(JSON.stringify(r.datos)).not.toContain('90002301"');
  });

  it("rechaza cambiar el correo o el DNI y un teléfono que no tiene 9 dígitos", { timeout: ESPERA }, async () => {
    for (const cuerpo of [{ email: "otro@prueba.kubo.test" }, { dni: "12345678" }, { telefono: "123" }]) {
      const r = await pedir(actualizarRuta, "/comunidad/mi-perfil", { token, metodo: "PATCH", cuerpo });
      expect(r.estado).toBe(400);
      expect(r.error?.code).toBe("DATOS_INVALIDOS");
    }
    const persona = await prisma.persona.findUniqueOrThrow({ where: { id: personas[0] } });
    expect(persona.email).toBe("90002301@prueba.kubo.test");
    expect(persona.dni).toBe("90002301");
  });

  it(
    "cambiar el teléfono guarda el valor y audita ACTUALIZAR_PERFIL con el anterior",
    { timeout: ESPERA },
    async () => {
      const nuevo = telefonoOriginal === "900000999" ? "900000998" : "900000999";
      const r = await actualizarMiPerfil(admin, { telefono: nuevo }, meta);
      expect(r.telefono).toBe(nuevo);
      const evento = await prisma.registroAuditoria.findFirstOrThrow({
        where: { accion: "ACTUALIZAR_PERFIL", entidadId: admin.personaId, requestId: meta.requestId },
      });
      expect(evento.usuarioId).toBe(admin.usuarioId);
      expect(evento.valorAnterior).toEqual({ telefono: telefonoOriginal });
      expect(evento.valorNuevo).toEqual({ telefono: nuevo });
      // sin cambios no se vuelve a auditar
      await actualizarMiPerfil(admin, { telefono: nuevo }, meta);
      expect(
        await prisma.registroAuditoria.count({
          where: { accion: "ACTUALIZAR_PERFIL", entidadId: admin.personaId, requestId: meta.requestId },
        }),
      ).toBe(1);
      expect((await miPerfil(admin)).telefono).toBe(nuevo);
    },
  );
});
