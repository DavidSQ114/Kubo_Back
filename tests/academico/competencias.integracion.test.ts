// Prueba de integración (US56, AD-04 «Catálogo oficial»): registrar una competencia con código único, no eliminar
// una competencia con calificaciones o asociada a un plan de estudios (solo desactivarla), una desactivada no se
// asocia a cursos nuevos y los planes la conservan, la bitácora con el valor anterior y el nuevo, y los permisos.
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/academico/competencias
// Crea sus propios datos ficticios en el año 2079 y DNI 900020xx, y los borra al terminar.
import "@/server/wiring";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/platform/auth/tokens";
import { prisma } from "@/platform/db/prisma";
import { DELETE as eliminarRuta } from "@/app/api/v1/academico/competencias/[id]/route";
import { GET as catalogoRuta, POST as registrarRuta } from "@/app/api/v1/academico/competencias/route";
import {
  catalogoDeCompetencias,
  editarCompetencia,
  eliminarCompetencia,
  guardarCompetenciasPlan,
  registrarCompetencia,
} from "@/modules/academico";
import { iniciarSesion, type Autenticado } from "@/modules/identidad";

vi.mock("@/platform/correo", () => ({
  enviarCorreo: vi.fn(async () => true),
  smtpConfigurado: () => false,
}));

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
const ANIO = 2079;
const CLAVE = "Prueba-Kubo-2079";
const meta = { requestId: `prueba-competencias-${Date.now()}`, ip: null, userAgent: null };
const ESPERA_PREPARACION = 120_000;
// códigos únicos por corrida: una competencia eliminada deja su fila en la bitácora, no en el catálogo
const SUFIJO = String(Date.now()).slice(-5);
const CODIGO = `MAT-P${SUFIJO}`;

type Manejador = (req: NextRequest, contexto: { params: Promise<Record<string, string>> }) => Promise<Response>;

async function pedir(
  manejador: Manejador,
  ruta: string,
  opciones: { token?: string; params?: Record<string, string>; metodo?: "POST" | "DELETE"; cuerpo?: unknown } = {},
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

describe.skipIf(!ACTIVA)("catálogo oficial de competencias (US56)", () => {
  let admin: Autenticado;
  let anioId: string;
  let areaMat: string;
  let cursoMat: string;
  let planConNotas: string;
  let competenciaId: string;
  const personas: string[] = [];
  const competenciasCreadas: string[] = [];
  const token: Record<string, string> = {};

  const auditoria = (entidadId: string, accion: string) =>
    prisma.registroAuditoria.findFirst({
      where: { entidadId, accion, entidadAfectada: "competencia", requestId: meta.requestId },
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
    areaMat = (await prisma.areaCurricular.findFirstOrThrow({ where: { codigo: "MAT" } })).id;
    cursoMat = (await prisma.curso.findFirstOrThrow({ where: { codigo: "MAT" } })).id;

    const passwordHash = await hashPassword(CLAVE);
    const ingresar = async (personaId: string, email: string) => {
      await prisma.usuario.create({
        data: { personaId, email, passwordHash, estado: "ACTIVO", debeCambiarPassword: false },
      });
      const r = await iniciarSesion({ email, password: CLAVE, recordar: false }, meta);
      if (r.tipo !== "SESION") throw new Error("La cuenta de prueba debe tener un solo perfil");
      return r.tokens.acceso;
    };
    const docente = await prisma.persona.create({
      data: {
        dni: "90002001",
        nombres: "Karen",
        apellidos: "Docente Prueba",
        email: "90002001@prueba.kubo.test",
        docente: { create: {} },
      },
      include: { docente: true },
    });
    personas.push(docente.id);
    token.docente = await ingresar(docente.id, "90002001@prueba.kubo.test");
    // administradora propia para llamar a la API: solo en lecturas y rechazos, que no auditan
    const a = await prisma.persona.create({
      data: {
        dni: "90002010",
        nombres: "Rosa",
        apellidos: "Admin Prueba",
        email: "90002010@prueba.kubo.test",
        administrador: { create: {} },
      },
    });
    personas.push(a.id);
    token.admin = await ingresar(a.id, "90002010@prueba.kubo.test");

    // año con un plan de Matemática de 1.° grado: después se le asocia la competencia nueva y se califica con ella
    const grado = await prisma.grado.findFirstOrThrow({ where: { numero: 1 } });
    anioId = (
      await prisma.anioAcademico.create({
        data: {
          anio: ANIO,
          fechaInicio: new Date(`${ANIO}-03-01T00:00:00Z`),
          fechaFin: new Date(`${ANIO}-12-15T00:00:00Z`),
        },
      })
    ).id;
    planConNotas = (
      await prisma.planEstudio.create({
        data: { anioAcademicoId: anioId, gradoId: grado.id, cursoId: cursoMat, horasSemanales: 4 },
      })
    ).id;
  }, ESPERA_PREPARACION);

  afterAll(async () => {
    if (!anioId) return;
    await prisma.cierreCalificacion.deleteMany({ where: { periodoEvaluacion: { anioAcademicoId: anioId } } });
    await prisma.reglaConsolidacion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.asignacionDocente.deleteMany({ where: { seccion: { anioAcademicoId: anioId } } });
    await prisma.planEstudio.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.matricula.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.competencia.deleteMany({ where: { id: { in: competenciasCreadas } } });
    await prisma.usuario.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.estudiante.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.docente.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.administrador.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.persona.deleteMany({ where: { id: { in: personas } } });
    await prisma.seccion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.periodoEvaluacion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.anioAcademico.delete({ where: { id: anioId } });
    await prisma.$disconnect();
  }, ESPERA_PREPARACION);

  it("permisos: sin sesión 401 y un docente no ve ni cambia el catálogo (403)", async () => {
    expect((await pedir(catalogoRuta, "/academico/competencias")).estado).toBe(401);
    expect((await pedir(catalogoRuta, "/academico/competencias", { token: token.docente })).estado).toBe(403);
    const alta = await pedir(registrarRuta, "/academico/competencias", {
      token: token.docente,
      metodo: "POST",
      cuerpo: { areaCurricularId: areaMat, codigo: "MAT-X1", nombre: "No debería crearse" },
    });
    expect(alta.estado).toBe(403);
    expect((await pedir(catalogoRuta, "/academico/competencias", { token: token.admin })).estado).toBe(200);
  });

  it("registra una competencia nueva en su área, disponible para los cursos de esa área (criterio 1)", async () => {
    const c = await registrarCompetencia(
      admin,
      {
        areaCurricularId: areaMat,
        codigo: CODIGO.toLowerCase(),
        nombre: "Usa el pensamiento computacional",
        descripcion: "Competencia de prueba publicada por el Ministerio",
      },
      meta,
    );
    competenciaId = c.id;
    competenciasCreadas.push(c.id);
    expect(c).toMatchObject({ codigo: CODIGO, activo: true, eliminable: true, uso: { planes: 0, notas: 0 } });
    expect(await auditoria(c.id, "REGISTRAR_COMPETENCIA")).not.toBeNull();

    // el código es único
    await expect(
      registrarCompetencia(admin, { areaCurricularId: areaMat, codigo: CODIGO, nombre: "Otra" }, meta),
    ).rejects.toMatchObject({ codigo: "COMPETENCIA_CODIGO_EN_USO" });

    // se puede asociar al plan de Matemática
    const plan = await guardarCompetenciasPlan(admin, planConNotas, [{ competenciaId }], meta);
    expect(plan.competencias.map((x) => x.competencia.codigo)).toEqual([CODIGO]);
  });

  it("asociada a un plan de estudios no se elimina", async () => {
    await expect(eliminarCompetencia(admin, competenciaId, meta)).rejects.toMatchObject({
      codigo: "COMPETENCIA_EN_PLAN",
    });
  });

  it("con calificaciones registradas no se elimina: solo se puede desactivar (criterio 2)", async () => {
    // una calificación con esa competencia en un registro ABIERTO del bimestre
    const grado = await prisma.grado.findFirstOrThrow({ where: { numero: 1 } });
    const seccion = await prisma.seccion.create({
      data: { anioAcademicoId: anioId, gradoId: grado.id, nombre: "CP", aforoMaximo: 5 },
    });
    const periodo = await prisma.periodoEvaluacion.create({
      data: {
        anioAcademicoId: anioId,
        numero: 1,
        nombre: "Bimestre I",
        fechaInicio: new Date(`${ANIO}-03-01T00:00:00Z`),
        fechaFin: new Date(`${ANIO}-05-10T00:00:00Z`),
      },
    });
    const regla = await prisma.reglaConsolidacion.create({
      data: {
        anioAcademicoId: anioId,
        nombre: "Moda",
        metodo: "MODA",
        configuracion: {},
        version: 1,
        estado: "VIGENTE",
      },
    });
    const docenteId = (await prisma.docente.findFirstOrThrow({ where: { personaId: personas[0] } })).id;
    const asignacion = await prisma.asignacionDocente.create({
      data: { planEstudioId: planConNotas, seccionId: seccion.id, docenteId },
    });
    const cierre = await prisma.cierreCalificacion.create({
      data: {
        asignacionDocenteId: asignacion.id,
        periodoEvaluacionId: periodo.id,
        reglaConsolidacionId: regla.id,
        estado: "ABIERTO",
      },
    });
    const alumno = await prisma.persona.create({
      data: {
        dni: "90002021",
        nombres: "Diego",
        apellidos: "Alumno Prueba",
        estudiante: { create: { gradoIngresoId: grado.id } },
      },
      include: { estudiante: true },
    });
    personas.push(alumno.id);
    const matricula = await prisma.matricula.create({
      data: {
        estudianteId: alumno.estudiante!.id,
        anioAcademicoId: anioId,
        // «En proceso» basta para calificar en la prueba: la confirmada exige responsable del pago y cronograma
        estado: "EN_PROCESO",
        registradoPorId: admin.usuarioId,
      },
    });
    const competenciaPlan = await prisma.competenciaPlan.findFirstOrThrow({
      where: { planEstudioId: planConNotas, competenciaId },
    });
    await prisma.nota.create({
      data: {
        cierreId: cierre.id,
        matriculaId: matricula.id,
        competenciaPlanId: competenciaPlan.id,
        logro: "A",
        registradoPorId: admin.usuarioId,
      },
    });

    const r = await pedir(eliminarRuta, `/academico/competencias/${competenciaId}`, {
      token: token.admin,
      metodo: "DELETE",
      params: { id: competenciaId },
    });
    expect(r.estado).toBe(409);
    expect(r.error?.code).toBe("COMPETENCIA_CON_CALIFICACIONES");
    expect(await prisma.competencia.findUnique({ where: { id: competenciaId } })).not.toBeNull();

    const delCatalogo = (await catalogoDeCompetencias())
      .flatMap((a) => a.competencias)
      .find((c) => c.id === competenciaId);
    expect(delCatalogo).toMatchObject({ uso: { planes: 1, notas: 1 }, eliminable: false });
  });

  it("desactivada no se asocia a cursos nuevos, pero el plan que la tiene la conserva", async () => {
    const c = await editarCompetencia(admin, competenciaId, { activo: false }, meta);
    expect(c.activo).toBe(false);
    const evento = await auditoria(competenciaId, "DESACTIVAR_COMPETENCIA");
    expect(evento?.valorAnterior).toMatchObject({ codigo: CODIGO, activo: true });
    expect(evento?.valorNuevo).toMatchObject({ codigo: CODIGO, activo: false });

    const grado2 = await prisma.grado.findFirstOrThrow({ where: { numero: 2 } });
    const planNuevo = await prisma.planEstudio.create({
      data: { anioAcademicoId: anioId, gradoId: grado2.id, cursoId: cursoMat, horasSemanales: 4 },
    });
    await expect(guardarCompetenciasPlan(admin, planNuevo.id, [{ competenciaId }], meta)).rejects.toMatchObject({
      codigo: "COMPETENCIA_INACTIVA",
    });
    // el plan anterior la conserva al volver a guardarse
    const conservado = await guardarCompetenciasPlan(admin, planConNotas, [{ competenciaId }], meta);
    expect(conservado.competencias).toHaveLength(1);
  });

  it("registra en la bitácora el cambio de descripción con el valor anterior y el nuevo (criterio 3)", async () => {
    await editarCompetencia(admin, competenciaId, { descripcion: "Descripción actualizada por el Ministerio" }, meta);
    const evento = await auditoria(competenciaId, "EDITAR_COMPETENCIA");
    expect(evento?.valorAnterior).toMatchObject({ descripcion: "Competencia de prueba publicada por el Ministerio" });
    expect(evento?.valorNuevo).toMatchObject({ descripcion: "Descripción actualizada por el Ministerio" });
    await expect(
      editarCompetencia(admin, competenciaId, { descripcion: "Descripción actualizada por el Ministerio" }, meta),
    ).rejects.toMatchObject({ codigo: "COMPETENCIA_SIN_CAMBIOS" });
  });

  it("una competencia sin uso sí se elimina, con auditoría", async () => {
    const libre = await registrarCompetencia(
      admin,
      { areaCurricularId: areaMat, codigo: `MAT-Q${SUFIJO}`, nombre: "Competencia sin uso" },
      meta,
    );
    competenciasCreadas.push(libre.id);
    expect(await eliminarCompetencia(admin, libre.id, meta)).toEqual({ competenciaId: libre.id, eliminada: true });
    expect(await prisma.competencia.findUnique({ where: { id: libre.id } })).toBeNull();
    expect(await auditoria(libre.id, "ELIMINAR_COMPETENCIA")).not.toBeNull();
  });
});
