// Bloque M5 · Datos de demostración para recorrer el plan de pruebas del profesor (solo datos ficticios, RNF14).
// Llama a la API real (KUBO_URL, por defecto http://localhost:3100) como lo haría cada rol y, en cada paso, prueba
// también un caso inválido. Solo para una base TEMPORAL o de demostración: nunca contra kubo_dev ni Neon.
//   npx tsx --env-file=.env.local scripts/demoRevision.ts
import { prisma } from "@/platform/db/prisma";

const BASE = `${process.env.KUBO_URL ?? "http://localhost:3100"}/api/v1`;
const ANIO = 2026;
const DOMINIO = "demo.kubo.test";
const ADMIN = "admin@kubo.edu.pe";
const COORDINACION = "coordinacion@kubo.edu.pe";
const CLAVE = process.env.KUBO_CLAVE_DEMO ?? "";

interface Respuesta {
  estado: number;
  data: unknown;
  error?: { code: string; message: string };
}

type Json = Record<string, unknown>;

class Cliente {
  private cookies = new Map<string, string>();
  constructor(readonly nombre: string) {}

  async pedir(metodo: string, ruta: string, cuerpo?: unknown): Promise<Respuesta> {
    const res = await fetch(`${BASE}${ruta}`, {
      method: metodo,
      headers: {
        ...(cuerpo === undefined ? {} : { "content-type": "application/json" }),
        cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    for (const c of res.headers.getSetCookie()) {
      const [par] = c.split(";");
      const i = par.indexOf("=");
      this.cookies.set(par.slice(0, i), par.slice(i + 1));
    }
    const tipo = res.headers.get("content-type") ?? "";
    if (!tipo.includes("json")) return { estado: res.status, data: await res.arrayBuffer() };
    const json = (await res.json()) as { data?: unknown; error?: Respuesta["error"] };
    return { estado: res.status, data: json.data, error: json.error };
  }

  /** Exige un estado; si no, detiene el script mostrando la respuesta. */
  async exigir<T = Json>(estado: number, metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
    const r = await this.pedir(metodo, ruta, cuerpo);
    if (r.estado !== estado) {
      throw new Error(
        `[${this.nombre}] ${metodo} ${ruta} → ${r.estado} (esperado ${estado}) ${JSON.stringify(r.error)}`,
      );
    }
    return r.data as T;
  }

  /** Caso inválido: debe responder el estado y el código esperados. */
  async rechazo(estado: number, codigo: string | null, metodo: string, ruta: string, cuerpo?: unknown) {
    const r = await this.pedir(metodo, ruta, cuerpo);
    const bien = r.estado === estado && (codigo === null || r.error?.code === codigo);
    process.stdout.write(
      `  ${bien ? "ok " : "MAL"} inválido ${metodo} ${ruta} → ${r.estado} ${r.error?.code ?? ""} «${r.error?.message ?? ""}»\n`,
    );
    if (!bien)
      fallas.push(`[${this.nombre}] ${metodo} ${ruta}: ${r.estado} ${r.error?.code} (esperado ${estado} ${codigo})`);
  }

  async entrar(email: string) {
    const r = await this.exigir<{ tipo: string; tokenSeleccion?: string }>(200, "POST", "/identidad/login", {
      email,
      password: CLAVE,
      recordar: false,
    });
    if (r.tipo !== "SESION") throw new Error(`${email} tiene varios perfiles (${r.tipo})`);
    return this;
  }
}

const fallas: string[] = [];
const paso = (texto: string) => process.stdout.write(`\n▶ ${texto}\n`);

/** Las cuentas nuevas reciben la misma contraseña de demostración que el administrador del seed. */
async function igualarClave(email: string) {
  await prisma.$executeRaw`
    UPDATE usuario SET password_hash = (SELECT password_hash FROM usuario WHERE email = ${ADMIN}),
      debe_cambiar_password = false, estado = 'ACTIVO' WHERE email = ${email}`;
}

async function main() {
  if (!CLAVE) throw new Error("Define KUBO_CLAVE_DEMO con la contraseña inicial del administrador del seed");
  const admin = await new Cliente("admin").entrar(ADMIN);
  const coord = await new Cliente("coord").entrar(COORDINACION);

  paso("Año 2026 con bimestres y montos (coordinador)");
  await coord.rechazo(400, null, "POST", "/academico/anios", {
    anio: ANIO,
    fechaInicio: "2026-12-18",
    fechaFin: "2026-03-02",
  });
  const anio = await coord.exigir<{ id: string }>(201, "POST", "/academico/anios", {
    anio: ANIO,
    fechaInicio: "2026-03-02",
    fechaFin: "2026-12-18",
  });
  await coord.rechazo(409, null, "POST", "/academico/anios", {
    anio: ANIO,
    fechaInicio: "2026-06-01",
    fechaFin: "2026-11-30",
  });
  const periodos = [
    { numero: 1, fechaInicio: "2026-03-02", fechaFin: "2026-05-08" },
    { numero: 2, fechaInicio: "2026-05-18", fechaFin: "2026-07-24" },
    { numero: 3, fechaInicio: "2026-08-10", fechaFin: "2026-10-09" },
    { numero: 4, fechaInicio: "2026-10-19", fechaFin: "2026-12-18" },
  ];
  await coord.rechazo(422, "PERIODOS_SOLAPADOS", "PUT", `/academico/anios/${anio.id}/periodos`, {
    periodos: [periodos[0], { ...periodos[1], fechaInicio: "2026-05-08" }, periodos[2], periodos[3]],
  });
  await coord.exigir(200, "PUT", `/academico/anios/${anio.id}/periodos`, { periodos });
  await coord.rechazo(400, null, "PUT", `/academico/anios/${anio.id}/montos`, {
    montoMatricula: "abc",
    montoPension: "450",
  });
  await coord.exigir(200, "PUT", `/academico/anios/${anio.id}/montos`, {
    montoMatricula: "350.00",
    montoPension: "450.00",
    montoIngreso: "200.00",
    montoMora: "20.00",
  });
  await coord.rechazo(400, null, "POST", `/academico/anios/${anio.id}/reglas`, { metodo: "PROMEDIO" });
  const conPeriodos = await coord.exigir<{ periodos: { id: string; numero: number }[] }>(
    200,
    "GET",
    `/academico/anios/${anio.id}`,
  );
  await coord.exigir(201, "POST", `/academico/anios/${anio.id}/reglas`, {
    metodo: "PONDERADO",
    rigeDesdeId: conPeriodos.periodos.find((p) => p.numero === 1)!.id,
  });
  await coord.exigir(200, "POST", `/academico/anios/${anio.id}/estado`, { estado: "EN_MATRICULA" });
  await coord.exigir(200, "POST", `/academico/anios/${anio.id}/estado`, { estado: "EN_CURSO" });

  paso("Espacios (administrador)");
  await admin.rechazo(400, null, "POST", "/academico/aulas", { nombre: "Aula 999", aforo: 0 });
  const aulas: Record<string, string> = {};
  for (const [nombre, ubicacion, aforo] of [
    ["Aula 101", "Pabellón A · 1.er piso", 30],
    ["Aula 102", "Pabellón A · 1.er piso", 30],
    ["Aula 201", "Pabellón A · 2.º piso", 30],
    ["Laboratorio de Ciencias", "Pabellón B · 1.er piso", 25],
  ] as const) {
    aulas[nombre] = (
      await admin.exigir<{ id: string }>(201, "POST", "/academico/aulas", { nombre, ubicacion, aforo })
    ).id;
  }
  await admin.rechazo(409, "AULA_DUPLICADA", "POST", "/academico/aulas", { nombre: "Aula 101", aforo: 30 });
  await coord.rechazo(403, "ACCESO_DENEGADO", "POST", "/academico/aulas", { nombre: "Aula 900", aforo: 30 });

  paso("Docentes (administrador)");
  const docentes: Record<string, { id: string; email: string }> = {};
  const datosDocentes = [
    ["mat", "70100001", "Rosa Elena", "Huamán Torres", "Matemática"],
    ["com", "70100002", "Luis Alberto", "Paredes Ríos", "Comunicación"],
    ["cyt", "70100003", "Carmen Rosa", "Salas Vega", "Ciencia y Tecnología"],
    ["ing", "70100004", "Jorge Manuel", "Castro León", "Inglés"],
  ] as const;
  for (const [clave, dni, nombres, apellidos, especialidad] of datosDocentes) {
    const email = `docente.${clave}@${DOMINIO}`;
    const d = await admin.exigir<{ docenteId: string }>(201, "POST", "/comunidad/docentes", {
      dni,
      nombres,
      apellidos,
      email,
      especialidad,
      telefono: "987654321",
      fechaNacimiento: "1985-06-14",
      sexo: clave === "mat" || clave === "cyt" ? "FEMENINO" : "MASCULINO",
    });
    docentes[clave] = { id: d.docenteId, email };
    await igualarClave(email);
  }
  await admin.rechazo(409, null, "POST", "/comunidad/docentes", {
    dni: "70100001",
    nombres: "Rosa Elena",
    apellidos: "Huamán Torres",
    email: "otra@demo.kubo.test",
    especialidad: "Matemática",
    telefono: "987654321",
    fechaNacimiento: "1985-06-14",
    sexo: "FEMENINO",
  });

  paso("Secciones con tutor y cotutor (coordinador)");
  const grados = await coord.exigir<{ id: string; numero: number }[]>(200, "GET", "/academico/grados");
  const grado = (n: number) => grados.find((g) => g.numero === n)!.id;
  const secciones: Record<string, string> = {};
  const datosSecciones = [
    ["1A", 1, "A", "Aula 101", "mat", "com"],
    ["1B", 1, "B", "Aula 102", "cyt", null],
    ["2A", 2, "A", "Aula 201", null, null],
  ] as const;
  for (const [clave, numero, nombre, aula, tutor, cotutor] of datosSecciones) {
    const s = await coord.exigir<{ id: string }>(201, "POST", "/academico/secciones", {
      anioAcademicoId: anio.id,
      gradoId: grado(numero),
      nombre,
      aforoMaximo: 30,
      aulaId: aulas[aula],
      tutorId: tutor ? docentes[tutor].id : null,
      cotutorId: cotutor ? docentes[cotutor].id : null,
    });
    secciones[clave] = s.id;
  }
  await coord.rechazo(409, null, "POST", "/academico/secciones", {
    anioAcademicoId: anio.id,
    gradoId: grado(1),
    nombre: "a",
    aforoMaximo: 30,
  });
  // una tutoría por docente y año: la tutora de 1.° A no puede ser tutora de 2.° A
  await coord.rechazo(409, null, "PATCH", `/academico/secciones/${secciones["2A"]}`, {
    gradoId: grado(2),
    nombre: "A",
    aforoMaximo: 30,
    aulaId: aulas["Aula 201"],
    tutorId: docentes.mat.id,
  });

  paso("Cursos del año con sus competencias (coordinador)");
  const areas = await coord.exigir<{ codigo: string; competencias: { id: string; codigo: string }[] }[]>(
    200,
    "GET",
    "/academico/areas",
  );
  const cursos = await coord.exigir<{ id: string; codigo: string }[]>(
    200,
    "GET",
    `/academico/cursos?anioId=${anio.id}`,
  );
  const curso = (codigo: string) => cursos.find((c) => c.codigo === codigo)!.id;
  const planes: Record<string, string> = {};
  for (const codigo of ["MAT", "COM", "CYT", "ING"]) {
    await coord.exigir(200, "PUT", `/academico/cursos/${curso(codigo)}/planes?anioId=${anio.id}`, {
      planes: [
        { gradoId: grado(1), horasSemanales: 5 },
        { gradoId: grado(2), horasSemanales: 5 },
      ],
    });
    const vista = await coord.exigir<{ grados: { grado: { numero: number }; plan: { id: string } | null }[] }>(
      200,
      "GET",
      `/academico/cursos/${curso(codigo)}/planes?anioId=${anio.id}`,
    );
    const area = areas.find((a) => a.codigo === codigo)!;
    for (const g of vista.grados.filter((x) => x.plan)) {
      planes[`${codigo}${g.grado.numero}`] = g.plan!.id;
      await coord.exigir(200, "PUT", `/academico/planes/${g.plan!.id}/competencias`, {
        competencias: area.competencias.slice(0, 3).map((c) => ({ competenciaId: c.id })),
      });
    }
  }
  await coord.rechazo(400, null, "PUT", `/academico/planes/${planes.MAT1}/competencias`, { competencias: [] });

  paso("Profesor responsable por sección (coordinador)");
  const asignar = [
    ["mat", "1A", "MAT"],
    ["mat", "1B", "MAT"],
    ["mat", "2A", "MAT"],
    ["com", "1A", "COM"],
    ["com", "1B", "COM"],
    ["cyt", "1A", "CYT"],
    ["cyt", "1B", "CYT"],
    ["ing", "1A", "ING"],
    ["ing", "1B", "ING"],
    ["com", "2A", "COM"],
  ] as const;
  for (const [docente, seccion, codigo] of asignar) {
    await coord.exigir(201, "POST", "/academico/asignaciones", {
      docenteId: docentes[docente].id,
      seccionId: secciones[seccion],
      cursoId: curso(codigo),
    });
  }
  await coord.rechazo(409, null, "POST", "/academico/asignaciones", {
    docenteId: docentes.com.id,
    seccionId: secciones["1A"],
    cursoId: curso("MAT"),
  });

  paso("Apoderados y estudiantes (coordinador)");
  const apoderados: Record<string, { id: string; email: string }> = {};
  const datosApoderados = [
    ["quispe", "41200001", "Jorge Luis", "Quispe Huamán", "MASCULINO"],
    ["rojas", "41200002", "María Elena", "Rojas Díaz", "FEMENINO"],
    ["flores", "41200003", "Ana Lucía", "Flores Paz", "FEMENINO"],
  ] as const;
  for (const [clave, dni, nombres, apellidos, sexo] of datosApoderados) {
    const email = `apoderado.${clave}@${DOMINIO}`;
    const a = await coord.exigir<{ apoderadoId: string }>(201, "POST", "/comunidad/apoderados", {
      dni,
      nombres,
      apellidos,
      fechaNacimiento: "1980-05-10",
      email,
      telefono: "987654321",
      direccion: "Jr. Lima 123, Lima",
      ocupacion: "Comerciante",
      sexo,
    });
    apoderados[clave] = { id: a.apoderadoId, email };
    await igualarClave(email);
  }
  await coord.rechazo(400, null, "POST", "/comunidad/apoderados", {
    dni: "41200009",
    nombres: "Sin",
    apellidos: "Teléfono",
    fechaNacimiento: "1980-05-10",
    email: "x@demo.kubo.test",
    telefono: "98765432",
    direccion: "Jr. Lima 123",
    ocupacion: "Comerciante",
  });
  const estudiantes: Record<string, string> = {};
  const datosEstudiantes = [
    ["valeria", "78400001", "Valeria Sofía", "Quispe Rojas", 1, "FEMENINO", ["quispe", "rojas"]],
    ["mateo", "78400002", "Mateo José", "Quispe Rojas", 1, "MASCULINO", ["quispe"]],
    ["camila", "78400003", "Camila Andrea", "Flores Paz", 1, "FEMENINO", ["flores"]],
    ["diego", "78400004", "Diego Alonso", "Flores Paz", 2, "MASCULINO", ["flores"]],
    ["lucia", "78400005", "Lucía Fernanda", "Rojas Díaz", 1, "FEMENINO", ["rojas"]],
  ] as const;
  for (const [clave, dni, nombres, apellidos, numero, sexo, aps] of datosEstudiantes) {
    const e = await coord.exigir<{ estudianteId: string }>(201, "POST", "/comunidad/estudiantes", {
      dni,
      nombres,
      apellidos,
      fechaNacimiento: "2013-04-22",
      gradoIngresoId: grado(numero),
      sexo,
      apoderados: aps.map((a, i) => ({
        apoderadoId: apoderados[a].id,
        parentesco:
          a === "rojas" && clave !== "lucia" ? "Madre" : apoderados[a].email.includes("quispe") ? "Padre" : "Madre",
        esPrincipal: i === 0,
      })),
    });
    estudiantes[clave] = e.estudianteId;
  }
  await coord.rechazo(400, null, "POST", "/comunidad/estudiantes", {
    dni: "78400009",
    nombres: "Sin",
    apellidos: "Apoderado",
    fechaNacimiento: "2013-04-22",
    gradoIngresoId: grado(1),
    sexo: "MASCULINO",
    apoderados: [],
  });
  await coord.rechazo(409, null, "POST", "/comunidad/estudiantes", {
    dni: "78400001",
    nombres: "Valeria Sofía",
    apellidos: "Quispe Rojas",
    fechaNacimiento: "2013-04-22",
    gradoIngresoId: grado(1),
    sexo: "FEMENINO",
    apoderados: [{ apoderadoId: apoderados.quispe.id, parentesco: "Padre", esPrincipal: true }],
  });

  paso("Matrícula en sección (coordinador); Lucía queda sin matrícula para la demostración");
  const matriculas: Record<string, string> = {};
  const vinculos: Record<string, string> = {};
  for (const [clave, seccion] of [
    ["valeria", "1A"],
    ["mateo", "1B"],
    ["camila", "1A"],
    ["diego", "2A"],
  ] as const) {
    const s = await coord.exigir<{ estudiante: { apoderados: { vinculoId: string }[] } }>(
      200,
      "GET",
      `/matricula/estudiantes/${estudiantes[clave]}?anioId=${anio.id}`,
    );
    const m = await coord.exigir<{ matriculaId: string }>(201, "POST", "/matricula/matriculas", {
      estudianteId: estudiantes[clave],
      anioAcademicoId: anio.id,
      seccionId: secciones[seccion],
      vinculoResponsableId: s.estudiante.apoderados[0].vinculoId,
      modalidadPago: "MENSUAL",
    });
    matriculas[clave] = m.matriculaId;
    vinculos[clave] = s.estudiante.apoderados[0].vinculoId;
  }
  await coord.rechazo(409, null, "POST", "/matricula/matriculas", {
    estudianteId: estudiantes.valeria,
    anioAcademicoId: anio.id,
    seccionId: secciones["1A"],
    vinculoResponsableId: vinculos.valeria,
    modalidadPago: "MENSUAL",
  });

  paso("Horario de 1.° A y 1.° B con cruces y publicación (coordinador)");
  const cursoDeDocente: Record<string, string> = { MAT: "mat", COM: "com", CYT: "cyt", ING: "ing" };
  const dias = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"];
  const cuadricula = await coord.exigir<{ bloques: { id: string; tipo: string }[] }>(
    200,
    "GET",
    `/horarios/secciones/${secciones["1A"]}`,
  );
  const bloquesClase = cuadricula.bloques.filter((b) => b.tipo === "CLASE");
  const recreo = cuadricula.bloques.find((b) => b.tipo !== "CLASE");
  const ponerClase = (seccion: string, aula: string, dia: string, bloque: string, codigo: string) =>
    coord.exigir(200, "PUT", `/horarios/secciones/${secciones[seccion]}/clases/${dia}/${bloque}`, {
      cursoId: curso(codigo),
      docenteId: docentes[cursoDeDocente[codigo]].id,
      aulaId: aulas[aula],
    });
  // las dos secciones usan las cuatro primeras horas, desfasadas: cada docente está en una sola sección a la vez
  const orden = ["MAT", "COM", "CYT", "ING"];
  for (const [d, dia] of dias.entries()) {
    for (let b = 0; b < 4; b++) {
      await ponerClase("1A", "Aula 101", dia, bloquesClase[b].id, orden[(b + d) % 4]);
      await ponerClase("1B", "Aula 102", dia, bloquesClase[b].id, orden[(b + d + 2) % 4]);
    }
  }
  if (recreo) {
    await coord.rechazo(
      422,
      "BLOQUE_DE_RECREO",
      "PUT",
      `/horarios/secciones/${secciones["1A"]}/clases/LUNES/${recreo.id}`,
      {
        cursoId: curso("MAT"),
        docenteId: docentes.mat.id,
        aulaId: aulas["Aula 101"],
      },
    );
  }
  // la docente de Matemática ya enseña en 1.° A el lunes a primera hora
  await coord.rechazo(
    409,
    "CRUCE_DOCENTE",
    "PUT",
    `/horarios/secciones/${secciones["2A"]}/clases/LUNES/${bloquesClase[0].id}`,
    {
      cursoId: curso("MAT"),
      docenteId: docentes.mat.id,
      aulaId: aulas["Aula 201"],
    },
  );
  // el docente de Comunicación está libre el lunes a primera hora, pero el Aula 101 la ocupa 1.° A
  await coord.rechazo(
    409,
    "AULA_OCUPADA",
    "PUT",
    `/horarios/secciones/${secciones["2A"]}/clases/LUNES/${bloquesClase[0].id}`,
    {
      cursoId: curso("COM"),
      docenteId: docentes.com.id,
      aulaId: aulas["Aula 101"],
    },
  );
  for (const s of ["1A", "1B"]) await coord.exigir(200, "POST", `/horarios/secciones/${secciones[s]}/publicar`);

  paso("Pago de la matrícula y la cuota de ingreso de Valeria (coordinador)");
  const cuenta = await coord.exigir<{
    cuotas: { id: string; tipo: string; estado: string; saldo?: string; monto: string }[];
  }>(200, "GET", `/matricula/estudiantes/${estudiantes.valeria}/estado-cuenta`);
  const primeras = cuenta.cuotas.filter((c) => c.tipo === "MATRICULA" || c.tipo === "INGRESO");
  const total = primeras.reduce((t, c) => t + Math.round(Number(c.monto) * 100), 0);
  await coord.rechazo(422, null, "POST", "/matricula/pagos", {
    conceptoIds: primeras.map((c) => c.id),
    monto: "1.00",
    medioPago: "TRANSFERENCIA",
    numeroOperacion: "OP-0001",
    fechaPago: "2026-11-25",
  });
  await coord.exigir(201, "POST", "/matricula/pagos", {
    conceptoIds: primeras.map((c) => c.id),
    monto: (total / 100).toFixed(2),
    medioPago: "TRANSFERENCIA",
    numeroOperacion: "OP-0001",
    fechaPago: "2026-11-25",
  });

  paso("Notas del IV bimestre de Matemática en 1.° A con ítems (docente)");
  const docMat = await new Cliente("docente.mat").entrar(docentes.mat.email);
  const mis = await docMat.exigir<{
    bimestreActivoId: string;
    cursos: { asignacionId: string; curso: { codigo: string }; seccion: { id: string } }[];
  }>(200, "GET", "/evaluacion/registros");
  const asignacionMat1A = mis.cursos.find((c) => c.curso.codigo === "MAT" && c.seccion.id === secciones["1A"])!;
  const rutaRegistro = `/evaluacion/registros/${asignacionMat1A.asignacionId}/bimestres/${mis.bimestreActivoId}`;
  let registro = await docMat.exigir<{
    competencias: { competenciaPlanId: string }[];
    alumnos: { matriculaId: string }[];
  }>(200, "GET", rutaRegistro);
  const [c1, ...otras] = registro.competencias.map((c) => c.competenciaPlanId);
  await docMat.rechazo(400, null, "PUT", `${rutaRegistro}/competencias/${c1}/items`, {
    items: [
      { nombre: "Práctica calificada", peso: 0 },
      { nombre: "Examen bimestral", peso: 100 },
    ],
    confirmar: false,
  });
  await docMat.exigir(200, "PUT", `${rutaRegistro}/competencias/${c1}/items`, {
    items: [
      { nombre: "Práctica calificada", peso: 40 },
      { nombre: "Examen bimestral", peso: 60 },
    ],
    confirmar: false,
  });
  const conItems = await docMat.exigir<{ competencias: { competenciaPlanId: string; items: { id: string }[] }[] }>(
    200,
    "GET",
    rutaRegistro,
  );
  const items = conItems.competencias.find((c) => c.competenciaPlanId === c1)!.items;
  const logros = ["AD", "A", "B"];
  await docMat.rechazo(400, null, "PUT", `${rutaRegistro}/notas`, {
    notas: [{ matriculaId: registro.alumnos[0].matriculaId, competenciaPlanId: otras[0], logro: "15" }],
  });
  await docMat.exigir(200, "PUT", `${rutaRegistro}/notas`, {
    calificaciones: registro.alumnos.flatMap((a, i) =>
      items.map((it, j) => ({ itemId: it.id, matriculaId: a.matriculaId, logro: logros[(i + j) % 3] })),
    ),
  });
  await docMat.exigir(200, "PUT", `${rutaRegistro}/notas`, {
    notas: registro.alumnos.flatMap((a, i) =>
      otras.map((c, j) => ({ matriculaId: a.matriculaId, competenciaPlanId: c, logro: logros[(i + j + 1) % 3] })),
    ),
  });
  registro = await docMat.exigir(200, "GET", rutaRegistro);

  paso("Notas parciales de Comunicación en 1.° A (docente) para modificar en el recorrido");
  const docCom = await new Cliente("docente.com").entrar(docentes.com.email);
  const misCom = await docCom.exigir<typeof mis>(200, "GET", "/evaluacion/registros");
  const asignacionCom1A = misCom.cursos.find((c) => c.curso.codigo === "COM" && c.seccion.id === secciones["1A"])!;
  const rutaCom = `/evaluacion/registros/${asignacionCom1A.asignacionId}/bimestres/${misCom.bimestreActivoId}`;
  const registroCom = await docCom.exigir<typeof registro>(200, "GET", rutaCom);
  await docCom.exigir(200, "PUT", `${rutaCom}/notas`, {
    notas: registroCom.alumnos.map((a) => ({
      matriculaId: a.matriculaId,
      competenciaPlanId: registroCom.competencias[0].competenciaPlanId,
      logro: "A",
    })),
  });
  // la docente de Comunicación no puede escribir en el registro de Matemática
  await docCom.rechazo(403, null, "PUT", `${rutaRegistro}/notas`, {
    notas: [{ matriculaId: registro.alumnos[0].matriculaId, competenciaPlanId: c1, logro: "A" }],
  });

  paso("Cierre del registro de Matemática 1.° A y publicación (docente y coordinador)");
  await docMat.exigir(200, "POST", `${rutaRegistro}/cerrar`);
  const publicables = await coord.pedir(
    "GET",
    `/evaluacion/publicaciones?anioId=${anio.id}&periodoId=${mis.bimestreActivoId}`,
  );
  const cierreIds =
    JSON.stringify(publicables.data)
      .match(/"cierreId":"([0-9a-f-]{36})"/g)
      ?.map((x) => x.slice(12, -1)) ?? [];
  if (cierreIds.length) await coord.exigir(200, "POST", "/evaluacion/publicaciones", { cierreIds });
  else fallas.push(`sin cierres para publicar: ${JSON.stringify(publicables).slice(0, 300)}`);

  paso("Conducta del IV bimestre en 1.° A (tutora)");
  await docMat.exigir(200, "PUT", `/evaluacion/tutoria/${secciones["1A"]}/conducta/${mis.bimestreActivoId}`, {
    notas: [{ matriculaId: matriculas.valeria, valor: "A", comentario: "Participa y ayuda a sus compañeros" }],
  });
  await docCom.rechazo(
    403,
    "NO_ES_TUTOR",
    "PUT",
    `/evaluacion/tutoria/${secciones["1B"]}/conducta/${mis.bimestreActivoId}`,
    {
      notas: [{ matriculaId: matriculas.mateo, valor: "A" }],
    },
  );

  paso("Acceso de Valeria al portal del alumno (coordinador)");
  const emailAlumna = `alumna.valeria@${DOMINIO}`;
  await coord.exigir(201, "POST", `/comunidad/estudiantes/${estudiantes.valeria}/acceso`, { email: emailAlumna });
  await igualarClave(emailAlumna);

  process.stdout.write(
    `\n${JSON.stringify({ anio: anio.id, aulas, docentes, secciones, planes, apoderados, estudiantes, matriculas }, null, 1)}\n`,
  );
}

main()
  .then(async () => {
    process.stdout.write(`\nFallas: ${fallas.length}\n${fallas.join("\n")}\n`);
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    process.stdout.write(`\nERROR ${(e as Error).message}\nFallas: ${fallas.join("\n")}\n`);
    await prisma.$disconnect();
    process.exit(1);
  });
