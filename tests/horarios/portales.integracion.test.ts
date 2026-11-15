// Prueba de integración (US34, US48, US49, US50): el horario en los portales. Acceso al portal del alumno (cuenta con
// contraseña temporal, ingreso y cambio obligatorio), horario del docente, del hijo del apoderado y del alumno, y la
// seguridad de cada endpoint: 401 sin sesión, 403 con otro perfil y nadie ve el horario de una sección ajena.
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/horarios/portales.integracion
// Crea sus propios datos ficticios en el año 2090 (dos familias, dos secciones) y los borra al terminar.
import "@/server/wiring";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/platform/auth/tokens";
import { prisma } from "@/platform/db/prisma";
import { enviarCorreo } from "@/platform/correo";
import { POST as crearAcceso } from "@/app/api/v1/comunidad/estudiantes/[id]/acceso/route";
import { GET as horarioAlumno } from "@/app/api/v1/horarios/alumno/horario/route";
import { GET as horarioHijo } from "@/app/api/v1/horarios/apoderado/hijos/[id]/horario/route";
import { GET as miHorario } from "@/app/api/v1/horarios/mi-horario/route";
import { GET as publicadoDeSeccion } from "@/app/api/v1/horarios/secciones/[id]/publicado/route";
import { GET as cursosAlumno } from "@/app/api/v1/matricula/alumno/cursos/route";
import { GET as panelAlumno } from "@/app/api/v1/matricula/alumno/panel/route";
import { crearAccesoAlumno } from "@/modules/comunidad";
import { asignarClase, obtenerCuadricula, publicarHorario, type Dia } from "@/modules/horarios";
import { cambiarPassword, iniciarSesion, type Autenticado } from "@/modules/identidad";
import { anularMatricula, confirmarMatricula } from "@/modules/matricula";

// los correos no salen de la prueba: se revisa cuáles se pidieron
vi.mock("@/platform/correo", () => ({
  enviarCorreo: vi.fn(async () => true),
  smtpConfigurado: () => false,
}));

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
const ANIO = 2090;
// contraseña ficticia de las cuentas que crea la prueba (cumple la política; no es de ninguna cuenta real)
const CLAVE = "Prueba-Kubo-2090";
// la bitácora es inmutable y conserva las filas de corridas anteriores: cada corrida usa su propio requestId
const meta = { requestId: `prueba-portales-${Date.now()}`, ip: null, userAgent: null };
const SIN_PERMISOS = "No tiene permisos para acceder a este recurso.";

type Manejador = (req: NextRequest, contexto: { params: Promise<Record<string, string>> }) => Promise<Response>;

/** Llama a un Route Handler como lo haría el navegador: con el token de acceso (o sin él) y sus params. */
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

describe.skipIf(!ACTIVA)("el horario en los portales: acceso por perfil y por vínculo (US34, US48, US49, US50)", () => {
  let admin: Autenticado;
  let anioId: string;
  let seccionA: string;
  let seccionB: string;
  let aula1: string;
  let aula2: string;
  let mat: string;
  /** Primer bloque de clase del año. */
  let bloque: string;
  const personas: string[] = [];
  const docentes: Record<"rivera" | "salas" | "nuevo", { id: string; email: string }> = {
    rivera: { id: "", email: "" },
    salas: { id: "", email: "" },
    nuevo: { id: "", email: "" },
  };
  const familias: { apoderadoEmail: string; estudianteId: string; matriculaId: string }[] = [];
  let estudianteSinMatricula: string;
  const token: Record<string, string> = {};
  const emailAlumno = "alumno.a.2090@prueba.kubo.test";
  let claveTemporal: string;
  const correo = vi.mocked(enviarCorreo);

  const asignar = (seccionId: string, dia: Dia, docenteId: string, aulaId: string) =>
    asignarClase(admin, seccionId, { dia, bloqueId: bloque }, { cursoId: mat, docenteId, aulaId }, meta);

  /** Inicia sesión como lo hace el login y devuelve el token de acceso. */
  async function ingresar(email: string, password = CLAVE) {
    const r = await iniciarSesion({ email, password, recordar: false }, meta);
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
      rol: "ADMINISTRADOR",
      debeCambiarPassword: false,
    };
    const passwordHash = await hashPassword(CLAVE);
    const cuenta = (personaId: string, email: string) =>
      prisma.usuario.create({ data: { personaId, email, passwordHash, estado: "ACTIVO", debeCambiarPassword: false } });

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
    ]) {
      await prisma.parametroInstitucion.create({
        data: { anioAcademicoId: anioId, clave, valor, actualizadoPorId: u.id },
      });
    }
    const seccion = (nombre: string) =>
      prisma.seccion.create({ data: { anioAcademicoId: anioId, gradoId: grado.id, nombre, aforoMaximo: 5 } });
    seccionA = (await seccion("PA")).id;
    seccionB = (await seccion("PB")).id;
    aula1 = (await prisma.aula.create({ data: { nombre: "Aula prueba P1", aforo: 30 } })).id;
    aula2 = (await prisma.aula.create({ data: { nombre: "Aula prueba P2", aforo: 30 } })).id;
    mat = (await prisma.curso.findFirstOrThrow({ where: { codigo: "MAT" } })).id;

    // tres docentes con cuenta: Rivera dicta en PA, Salas en PB y el tercero aún no tiene cursos
    for (const [clave, dni, nombres, apellidos] of [
      ["rivera", "90000901", "Karen", "Rivera Prueba"],
      ["salas", "90000902", "Raúl", "Salas Prueba"],
      ["nuevo", "90000903", "Nuevo", "Docente Prueba"],
    ] as const) {
      const email = `${dni}@prueba.kubo.test`;
      const p = await prisma.persona.create({
        data: { dni, nombres, apellidos, email, docente: { create: {} } },
        include: { docente: true },
      });
      personas.push(p.id);
      await cuenta(p.id, email);
      docentes[clave] = { id: p.docente!.id, email };
    }
    // plan del grado: Matemática 1 hora; un docente distinto en cada sección
    const plan = await prisma.planEstudio.create({
      data: { anioAcademicoId: anioId, gradoId: grado.id, cursoId: mat, horasSemanales: 1 },
    });
    await prisma.asignacionDocente.create({
      data: { planEstudioId: plan.id, seccionId: seccionA, docenteId: docentes.rivera.id },
    });
    await prisma.asignacionDocente.create({
      data: { planEstudioId: plan.id, seccionId: seccionB, docenteId: docentes.salas.id },
    });

    // dos familias: el hijo de la primera está en PA y el de la segunda, en PB
    for (const [n, seccionId] of [
      [1, seccionA],
      [2, seccionB],
    ] as const) {
      const apoderadoEmail = `9000091${n}@prueba.kubo.test`;
      const ap = await prisma.persona.create({
        data: {
          dni: `9000091${n}`,
          nombres: "Prueba",
          apellidos: `Apoderado ${n}`,
          email: apoderadoEmail,
          apoderado: { create: {} },
        },
        include: { apoderado: true },
      });
      const es = await prisma.persona.create({
        data: {
          dni: `9000092${n}`,
          nombres: n === 1 ? "Diego" : "Valeria",
          apellidos: `Estudiante ${n}`,
          estudiante: { create: { gradoIngresoId: grado.id } },
        },
        include: { estudiante: true },
      });
      personas.push(ap.id, es.id);
      await cuenta(ap.id, apoderadoEmail);
      const v = await prisma.vinculoApoderado.create({
        data: {
          estudianteId: es.estudiante!.id,
          apoderadoId: ap.apoderado!.id,
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
      familias.push({ apoderadoEmail, estudianteId: es.estudiante!.id, matriculaId: m.matriculaId });
    }
    const sinMatricula = await prisma.persona.create({
      data: {
        dni: "90000923",
        nombres: "Sin",
        apellidos: "Matrícula Prueba",
        estudiante: { create: { gradoIngresoId: grado.id } },
      },
      include: { estudiante: true },
    });
    personas.push(sinMatricula.id);
    estudianteSinMatricula = sinMatricula.estudiante!.id;

    // horario de PA publicado (lunes, primer bloque, aula 1); el de PB queda en borrador (martes, sin publicar)
    bloque = (await obtenerCuadricula(seccionA)).bloques.find((b) => b.tipo === "CLASE")!.id;
    await asignar(seccionA, "LUNES", docentes.rivera.id, aula1);
    await publicarHorario(admin, seccionA, meta);
    await asignar(seccionB, "MARTES", docentes.salas.id, aula1);

    for (const [clave, email] of [
      ["rivera", docentes.rivera.email],
      ["salas", docentes.salas.email],
      ["nuevo", docentes.nuevo.email],
      ["apoderadoA", familias[0].apoderadoEmail],
      ["apoderadoB", familias[1].apoderadoEmail],
    ] as const) {
      token[clave] = await ingresar(email);
    }
    correo.mockClear();
  });

  afterAll(async () => {
    if (!anioId) return;
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
    await prisma.aula.deleteMany({ where: { id: { in: [aula1, aula2] } } });
    await prisma.parametroInstitucion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.anioAcademico.delete({ where: { id: anioId } });
    await prisma.$disconnect();
  });

  // ---------- US49 · Acceso al portal del alumno ----------

  it("crea el acceso del estudiante: cuenta pendiente, contraseña temporal una sola vez, auditoría y correo", async () => {
    // El caso de uso se llama con el administrador del seed: quien queda en la bitácora no se puede borrar después.
    // El endpoint (solo Administrador) se prueba más abajo con 401 y 403.
    const [a] = familias;
    const r = await crearAccesoAlumno(admin, a.estudianteId, { email: emailAlumno }, "http://localhost", meta);
    expect(r).toMatchObject({ estudianteId: a.estudianteId, email: emailAlumno, correoEnviado: true });
    claveTemporal = r.passwordTemporal!;
    expect(claveTemporal).toHaveLength(12);

    const u = await prisma.usuario.findUniqueOrThrow({ where: { email: emailAlumno } });
    expect(u).toMatchObject({ estado: "PENDIENTE_ACTIVACION", debeCambiarPassword: true });
    expect(u.passwordHash).not.toContain(claveTemporal);
    const auditoria = await prisma.registroAuditoria.findMany({
      where: { accion: "CREAR_ACCESO_ALUMNO", requestId: meta.requestId, entidadId: u.id },
    });
    expect(auditoria).toHaveLength(1);
    expect(JSON.stringify(auditoria[0].valorNuevo)).not.toContain(claveTemporal);
    expect(correo).toHaveBeenCalledTimes(1);
    expect(correo.mock.calls[0][0]).toMatchObject({ para: emailAlumno });
    // la persona queda con el correo de su cuenta (US69: el correo vigente es el de la cuenta)
    expect((await prisma.persona.findUniqueOrThrow({ where: { id: u.personaId } })).email).toBe(emailAlumno);
  });

  it("no crea el acceso dos veces, ni sin matrícula vigente, ni con un correo que ya usa otra cuenta", async () => {
    const [a, b] = familias;
    const datos = { email: "otro.2090@prueba.kubo.test" };
    await expect(crearAccesoAlumno(admin, a.estudianteId, datos, "http://localhost", meta)).rejects.toMatchObject({
      codigo: "ACCESO_EXISTENTE",
      estadoHttp: 409,
    });
    await expect(
      crearAccesoAlumno(admin, estudianteSinMatricula, datos, "http://localhost", meta),
    ).rejects.toMatchObject({ codigo: "SIN_MATRICULA_VIGENTE", estadoHttp: 422 });
    await expect(
      crearAccesoAlumno(admin, b.estudianteId, { email: emailAlumno }, "http://localhost", meta),
    ).rejects.toMatchObject({ codigo: "EMAIL_EN_USO", estadoHttp: 409 });
    expect(await prisma.usuario.count({ where: { persona: { estudiante: { id: b.estudianteId } } } })).toBe(0);
  });

  it("con credenciales incorrectas responde «Correo o contraseña incorrectos», sin decir cuál falló", async () => {
    const malas = [
      { email: emailAlumno, password: "Clave-Equivocada-1" },
      { email: "no.existe.2090@prueba.kubo.test", password: claveTemporal },
    ];
    for (const credenciales of malas) {
      const error = await iniciarSesion({ ...credenciales, recordar: false }, meta).catch((e) => e);
      expect(error).toMatchObject({ codigo: "CREDENCIALES_INVALIDAS", estadoHttp: 401 });
      expect(error.message).toMatch(/^Correo o contraseña incorrectos/);
    }
  });

  it("el alumno ingresa con el perfil Alumno y debe cambiar la contraseña temporal antes de ver su portal", async () => {
    const r = await iniciarSesion({ email: emailAlumno, password: claveTemporal, recordar: false }, meta);
    if (r.tipo !== "SESION") throw new Error("El alumno tiene un solo perfil");
    expect(r.sesion).toMatchObject({ rolActivo: "ALUMNO", perfiles: ["ALUMNO"], debeCambiarPassword: true });
    const antes = await pedir(horarioAlumno, "/horarios/alumno/horario", { token: r.tokens.acceso });
    expect(antes).toMatchObject({ estado: 403, error: { code: "CAMBIO_PASSWORD_REQUERIDO" } });

    const sesion = await prisma.sesion.findFirstOrThrow({
      where: { usuario: { email: emailAlumno }, revocadaEn: null },
      include: { usuario: true },
    });
    const alumno: Autenticado = {
      usuarioId: sesion.usuarioId,
      sesionId: sesion.id,
      personaId: sesion.usuario.personaId,
      email: emailAlumno,
      rol: "ALUMNO",
      debeCambiarPassword: true,
    };
    await cambiarPassword(alumno, { actual: claveTemporal, nueva: CLAVE }, meta);
    token.alumno = await ingresar(emailAlumno);
    const panel = await pedir(panelAlumno, "/matricula/alumno/panel", { token: token.alumno });
    expect(panel.estado).toBe(200);
    expect(panel.datos).toMatchObject({
      estudiante: { estudianteId: familias[0].estudianteId, nombres: "Diego", iniciales: "DE" },
      anio: ANIO,
      seccion: "PA",
      seccionCorta: "1° PA",
    });
  });

  it("«Mis cursos» lista los cursos del plan de su sección con su docente", async () => {
    const r = await pedir(cursosAlumno, "/matricula/alumno/cursos", { token: token.alumno });
    expect(r.estado).toBe(200);
    expect(r.datos.seccionCorta).toBe("1° PA");
    expect(r.datos.cursos).toMatchObject([
      {
        codigo: "MAT",
        horasSemanales: 1,
        docente: { nombreCompleto: "Karen Rivera Prueba", nombreCorto: "K. Rivera" },
      },
    ]);
  });

  // ---------- Seguridad de cada endpoint ----------

  it("sin sesión, todos los endpoints responden 401", async () => {
    const [a] = familias;
    const sinSesion = [
      await pedir(miHorario, "/horarios/mi-horario"),
      await pedir(horarioAlumno, "/horarios/alumno/horario"),
      await pedir(horarioHijo, `/horarios/apoderado/hijos/${a.estudianteId}/horario`, {
        params: { id: a.estudianteId },
      }),
      await pedir(publicadoDeSeccion, `/horarios/secciones/${seccionA}/publicado`, { params: { id: seccionA } }),
      await pedir(panelAlumno, "/matricula/alumno/panel"),
      await pedir(cursosAlumno, "/matricula/alumno/cursos"),
      await pedir(crearAcceso, `/comunidad/estudiantes/${a.estudianteId}/acceso`, {
        params: { id: a.estudianteId },
        cuerpo: { email: "x@prueba.kubo.test" },
      }),
    ];
    for (const r of sinSesion) expect(r).toMatchObject({ estado: 401, error: { code: "NO_AUTENTICADO" } });
  });

  it("con otro perfil, todos responden 403 «No tiene permisos para acceder a este recurso.»", async () => {
    const [a] = familias;
    const hijo = { params: { id: a.estudianteId } };
    const rutaHijo = `/horarios/apoderado/hijos/${a.estudianteId}/horario`;
    const rutaSeccion = `/horarios/secciones/${seccionA}/publicado`;
    const rutaAcceso = `/comunidad/estudiantes/${a.estudianteId}/acceso`;
    const acceso = { ...hijo, cuerpo: { email: "x@prueba.kubo.test" } };
    const conOtroPerfil = [
      // «Mi horario» del docente: ni el alumno ni el apoderado
      await pedir(miHorario, "/horarios/mi-horario", { token: token.alumno }),
      await pedir(miHorario, "/horarios/mi-horario", { token: token.apoderadoA }),
      // horario y panel del alumno: ni el docente ni el apoderado
      await pedir(horarioAlumno, "/horarios/alumno/horario", { token: token.rivera }),
      await pedir(horarioAlumno, "/horarios/alumno/horario", { token: token.apoderadoA }),
      await pedir(panelAlumno, "/matricula/alumno/panel", { token: token.apoderadoA }),
      await pedir(cursosAlumno, "/matricula/alumno/cursos", { token: token.rivera }),
      // horario del hijo: ni el alumno (aunque sea él mismo) ni el docente
      await pedir(horarioHijo, rutaHijo, { ...hijo, token: token.alumno }),
      await pedir(horarioHijo, rutaHijo, { ...hijo, token: token.rivera }),
      // horario de una sección por su id: solo el administrador
      await pedir(publicadoDeSeccion, rutaSeccion, { params: { id: seccionA }, token: token.rivera }),
      await pedir(publicadoDeSeccion, rutaSeccion, { params: { id: seccionA }, token: token.alumno }),
      await pedir(publicadoDeSeccion, rutaSeccion, { params: { id: seccionA }, token: token.apoderadoA }),
      // crear accesos: solo el administrador
      await pedir(crearAcceso, rutaAcceso, { ...acceso, token: token.apoderadoA }),
      await pedir(crearAcceso, rutaAcceso, { ...acceso, token: token.alumno }),
    ];
    for (const r of conOtroPerfil) {
      expect(r).toMatchObject({ estado: 403, error: { code: "ACCESO_DENEGADO", message: SIN_PERMISOS } });
    }
  });

  // ---------- US34 · Mi horario del docente ----------

  it("el docente ve sus clases publicadas con curso, sección y aula, y nunca las de otro docente", async () => {
    const r = await pedir(miHorario, `/horarios/mi-horario?anioId=${anioId}`, { token: token.rivera });
    expect(r.estado).toBe(200);
    expect(r.datos.clases).toMatchObject([
      {
        dia: "LUNES",
        bloqueId: bloque,
        curso: { codigo: "MAT" },
        seccion: { id: seccionA, etiqueta: "1° PA" },
        aula: { id: aula1, nombre: "Aula prueba P1" },
      },
    ]);
    expect(r.datos.resumen).toEqual({ bloques: 1, secciones: ["1° PA"] });
    expect(JSON.stringify(r.datos)).not.toContain(seccionB);
  });

  it("sin clases publicadas el docente recibe un horario vacío (ni el borrador de su sección se muestra)", async () => {
    for (const docente of ["nuevo", "salas"] as const) {
      const r = await pedir(miHorario, `/horarios/mi-horario?anioId=${anioId}`, { token: token[docente] });
      expect(r.estado).toBe(200);
      expect(r.datos.clases).toEqual([]);
      expect(r.datos.resumen).toEqual({ bloques: 0, secciones: [] });
    }
  });

  // ---------- US48 · Horario del hijo (apoderado) y US50 · Mi horario (alumno) ----------

  it("el alumno y su apoderado ven el horario publicado de su sección con curso, aula y docente", async () => {
    const [a] = familias;
    const delAlumno = await pedir(horarioAlumno, "/horarios/alumno/horario", { token: token.alumno });
    const delHijo = await pedir(horarioHijo, `/horarios/apoderado/hijos/${a.estudianteId}/horario`, {
      params: { id: a.estudianteId },
      token: token.apoderadoA,
    });
    for (const r of [delAlumno, delHijo]) {
      expect(r.estado).toBe(200);
      expect(r.datos).toMatchObject({
        estudiante: { estudianteId: a.estudianteId, nombres: "Diego" },
        seccion: { id: seccionA, etiqueta: "1° PA" },
        horario: { version: 1, estado: "PUBLICADO" },
      });
      expect(r.datos.clases).toMatchObject([
        {
          dia: "LUNES",
          curso: { codigo: "MAT", nombre: expect.any(String) },
          aula: { nombre: "Aula prueba P1" },
          docente: { nombreCompleto: "Karen Rivera Prueba", nombreCorto: "K. Rivera" },
        },
      ]);
      expect(r.datos.bloques.filter((b: { tipo: string }) => b.tipo === "CLASE")).toHaveLength(7);
    }
  });

  it("un apoderado no ve el horario del hijo de otra familia, aunque use su id real: 403", async () => {
    const [a, b] = familias;
    const ajeno = await pedir(horarioHijo, `/horarios/apoderado/hijos/${b.estudianteId}/horario`, {
      params: { id: b.estudianteId },
      token: token.apoderadoA,
    });
    expect(ajeno).toMatchObject({ estado: 403, error: { code: "ESTUDIANTE_NO_VINCULADO" } });
    const alReves = await pedir(horarioHijo, `/horarios/apoderado/hijos/${a.estudianteId}/horario`, {
      params: { id: a.estudianteId },
      token: token.apoderadoB,
    });
    expect(alReves).toMatchObject({ estado: 403, error: { code: "ESTUDIANTE_NO_VINCULADO" } });
    const invalido = await pedir(horarioHijo, "/horarios/apoderado/hijos/no-es-un-id/horario", {
      params: { id: "no-es-un-id" },
      token: token.apoderadoA,
    });
    expect(invalido.estado).toBe(400);
  });

  it("si la sección aún no publica su horario, llega sin horario y sin las clases del borrador", async () => {
    const [, b] = familias;
    const r = await pedir(horarioHijo, `/horarios/apoderado/hijos/${b.estudianteId}/horario`, {
      params: { id: b.estudianteId },
      token: token.apoderadoB,
    });
    expect(r.estado).toBe(200);
    expect(r.datos).toMatchObject({ seccion: { id: seccionB }, horario: null, clases: [] });
  });

  it("al publicarse el horario, o una versión nueva, se ve en la siguiente consulta sin hacer nada más", async () => {
    const [a, b] = familias;
    const consultarB = () =>
      pedir(horarioHijo, `/horarios/apoderado/hijos/${b.estudianteId}/horario`, {
        params: { id: b.estudianteId },
        token: token.apoderadoB,
      });
    await publicarHorario(admin, seccionB, meta);
    expect((await consultarB()).datos).toMatchObject({
      horario: { version: 1 },
      clases: [{ dia: "MARTES", docente: { nombreCorto: "R. Salas" } }],
    });

    // el administrador cambia el aula de la clase de PA: mientras es borrador, los portales siguen en la versión 1
    await asignar(seccionA, "LUNES", docentes.rivera.id, aula2);
    const enBorrador = await pedir(horarioAlumno, "/horarios/alumno/horario", { token: token.alumno });
    expect(enBorrador.datos).toMatchObject({ horario: { version: 1 }, clases: [{ aula: { id: aula1 } }] });

    await publicarHorario(admin, seccionA, meta);
    const delAlumno = await pedir(horarioAlumno, "/horarios/alumno/horario", { token: token.alumno });
    const delHijo = await pedir(horarioHijo, `/horarios/apoderado/hijos/${a.estudianteId}/horario`, {
      params: { id: a.estudianteId },
      token: token.apoderadoA,
    });
    const delDocente = await pedir(miHorario, `/horarios/mi-horario?anioId=${anioId}`, { token: token.rivera });
    for (const r of [delAlumno, delHijo]) {
      expect(r.datos).toMatchObject({ horario: { version: 2 }, clases: [{ aula: { id: aula2 } }] });
      expect(r.datos.clases).toHaveLength(1);
    }
    expect(delDocente.datos.clases).toMatchObject([{ aula: { id: aula2 }, seccion: { id: seccionA } }]);
    expect(delDocente.datos.clases).toHaveLength(1);
  });

  it("sin matrícula vigente (anulada) el alumno ya no entra a su portal y el apoderado no ve su horario", async () => {
    const [a] = familias;
    await anularMatricula(admin, a.matriculaId, { motivo: "ERROR_DIGITACION", detalle: "Prueba de integración" }, meta);
    for (const [manejador, ruta] of [
      [horarioAlumno, "/horarios/alumno/horario"],
      [panelAlumno, "/matricula/alumno/panel"],
      [cursosAlumno, "/matricula/alumno/cursos"],
    ] as const) {
      const r = await pedir(manejador, ruta, { token: token.alumno });
      expect(r).toMatchObject({ estado: 403, error: { code: "SIN_MATRICULA_VIGENTE" } });
    }
    const delHijo = await pedir(horarioHijo, `/horarios/apoderado/hijos/${a.estudianteId}/horario`, {
      params: { id: a.estudianteId },
      token: token.apoderadoA,
    });
    expect(delHijo).toMatchObject({ estado: 403, error: { code: "ESTUDIANTE_NO_VINCULADO" } });
  });
});
