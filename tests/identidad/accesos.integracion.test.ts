// Prueba de integración (bloque M1): separación estricta de accesos en el servidor entre el Administrador y el
// Coordinador académico. El administrador recibe 403 en una ruta de cada módulo del coordinador; el coordinador, en
// usuarios, parámetros, auditoría y errores; y los dos leen lo compartido (aulas, docentes, áreas).
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/identidad/accesos
// Crea sus propios datos ficticios con DNI 900021xx y los borra al terminar. Solo hace lecturas y rechazos (no audita).
import "@/server/wiring";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/platform/db/prisma";
import { GET as areasRuta } from "@/app/api/v1/academico/areas/route";
import { GET as aulasRuta, POST as registrarAulaRuta } from "@/app/api/v1/academico/aulas/route";
import { GET as cursosRuta } from "@/app/api/v1/academico/cursos/route";
import { POST as registrarCoordinadorRuta } from "@/app/api/v1/comunidad/coordinadores/route";
import { GET as docentesRuta } from "@/app/api/v1/comunidad/docentes/route";
import { PATCH as editarPersonaRuta } from "@/app/api/v1/comunidad/personas/[id]/route";
import { GET as usuariosRuta } from "@/app/api/v1/comunidad/usuarios/route";
import { GET as rectificacionesRuta } from "@/app/api/v1/evaluacion/rectificaciones/route";
import { GET as asistenciaDocenteRuta } from "@/app/api/v1/horarios/asistencia-docente/route";
import { GET as horarioSeccionRuta } from "@/app/api/v1/horarios/secciones/[id]/route";
import { GET as erroresRuta } from "@/app/api/v1/identidad/errores/route";
import { POST as suspenderRuta } from "@/app/api/v1/identidad/usuarios/[id]/suspender/route";
import { GET as matriculasRuta } from "@/app/api/v1/matricula/matriculas/route";
import { borrarCuentasDePrueba, crearSesionAdministrador, crearSesionCoordinador, pedir } from "../ayudantes/sesiones";

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
const CLAVE = "Prueba-Kubo-M1-2026";
const ID_CUALQUIERA = "00000000-0000-4000-8000-000000000001";
const ESPERA_PREPARACION = 120_000;

describe.skipIf(!ACTIVA)("separación de accesos Administrador / Coordinador académico (bloque M1)", () => {
  const personas: string[] = [];
  const token = { admin: "", coordinador: "" };
  let docentePersonaId: string;

  beforeAll(async () => {
    process.env.JWT_SECRET ??= "clave-de-firma-solo-para-pruebas-de-integracion";
    const admin = await crearSesionAdministrador("90002101", CLAVE);
    const coordinador = await crearSesionCoordinador("90002102", CLAVE);
    personas.push(admin.personaId, coordinador.personaId);
    token.admin = admin.token;
    token.coordinador = coordinador.token;
    const docente = await prisma.persona.create({
      data: {
        dni: "90002103",
        nombres: "Luis",
        apellidos: "Docente Prueba",
        email: "90002103@prueba.kubo.test",
        docente: { create: {} },
      },
    });
    docentePersonaId = docente.id;
  }, ESPERA_PREPARACION);

  afterAll(async () => {
    await borrarCuentasDePrueba(personas);
    if (docentePersonaId) {
      await prisma.docente.deleteMany({ where: { personaId: docentePersonaId } });
      await prisma.persona.deleteMany({ where: { id: docentePersonaId } });
    }
    await prisma.$disconnect();
  }, ESPERA_PREPARACION);

  it("el administrador recibe 403 en una ruta de cada módulo del coordinador", async () => {
    const llamadas = [
      pedir(cursosRuta, "/academico/cursos", { token: token.admin }),
      pedir(matriculasRuta, "/matricula/matriculas", { token: token.admin }),
      pedir(horarioSeccionRuta, "/horarios/secciones/…", { token: token.admin, params: { id: ID_CUALQUIERA } }),
      pedir(rectificacionesRuta, "/evaluacion/rectificaciones", { token: token.admin }),
    ];
    for (const r of await Promise.all(llamadas)) {
      expect(r.estado).toBe(403);
      expect(r.error?.code).toBe("ACCESO_DENEGADO");
    }
  });

  it("el coordinador recibe 403 en usuarios, cuentas, espacios, asistencia docente y errores", async () => {
    const llamadas = [
      pedir(usuariosRuta, "/comunidad/usuarios", { token: token.coordinador }),
      pedir(registrarCoordinadorRuta, "/comunidad/coordinadores", { token: token.coordinador, cuerpo: {} }),
      pedir(suspenderRuta, "/identidad/usuarios/…/suspender", {
        token: token.coordinador,
        params: { id: ID_CUALQUIERA },
        cuerpo: {},
      }),
      pedir(registrarAulaRuta, "/academico/aulas", { token: token.coordinador, cuerpo: {} }),
      pedir(asistenciaDocenteRuta, "/horarios/asistencia-docente", { token: token.coordinador }),
      pedir(erroresRuta, "/identidad/errores", { token: token.coordinador }),
    ];
    for (const r of await Promise.all(llamadas)) {
      expect(r.estado).toBe(403);
      expect(r.error?.code).toBe("ACCESO_DENEGADO");
    }
  });

  it(
    "cada uno entra a lo suyo: usuarios para el administrador, cursos y rectificaciones para el coordinador",
    { timeout: 30_000 },
    async () => {
      expect((await pedir(usuariosRuta, "/comunidad/usuarios", { token: token.admin })).estado).toBe(200);
      expect((await pedir(cursosRuta, "/academico/cursos", { token: token.coordinador })).estado).toBe(200);
      expect(
        (await pedir(rectificacionesRuta, "/evaluacion/rectificaciones", { token: token.coordinador })).estado,
      ).toBe(200);
    },
  );

  it("los dos leen lo compartido: aulas, docentes y áreas curriculares", { timeout: 30_000 }, async () => {
    for (const t of [token.admin, token.coordinador]) {
      expect((await pedir(aulasRuta, "/academico/aulas", { token: t })).estado).toBe(200);
      expect((await pedir(docentesRuta, "/comunidad/docentes", { token: t })).estado).toBe(200);
      expect((await pedir(areasRuta, "/academico/areas", { token: t })).estado).toBe(200);
    }
  });

  it("el coordinador no modifica los datos de un docente: 403 PERSONA_FUERA_DE_ALCANCE", async () => {
    const r = await pedir(editarPersonaRuta, "/comunidad/personas/…", {
      token: token.coordinador,
      params: { id: docentePersonaId },
      metodo: "PATCH",
      cuerpo: { telefono: "987654321" },
    });
    expect(r.estado).toBe(403);
    expect(r.error?.code).toBe("PERSONA_FUERA_DE_ALCANCE");
    const docente = await prisma.persona.findUniqueOrThrow({ where: { id: docentePersonaId } });
    expect(docente.telefono).toBeNull();
  });
});
