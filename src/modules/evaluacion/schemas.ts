// evaluacion/schemas: validación de las entradas de la API del registro de notas (US37, US39, US40), de la
// rectificación de nota (US41) y de la bitácora de notas (US03), RNF16.
// Mensajes en español; un logro fuera de la escala responde con el mensaje del backlog (US37, criterio 2).
import { z } from "zod";
import { erroresEvaluacion as E, MENSAJE_VALOR_NO_PERMITIDO } from "./domain/errores";
import { LOGROS_NOTA, type NotaPedida } from "./domain/notas";
import { LARGO_MAXIMO_MOTIVO } from "./domain/rectificacion";

export const IdSchema = z.string().uuid("Identificador no válido");

/** Ruta /registros/{asignacionId}/bimestres/{periodoId}. */
export const RegistroParamsSchema = z.object({ asignacionId: IdSchema, periodoId: IdSchema });

/** Una sección tiene a lo más unos 40 alumnos y un curso unas 6 competencias: 500 celdas sobran. */
const MAXIMO_NOTAS_POR_GUARDADO = 500;

const LogroSchema = z.enum(LOGROS_NOTA, { message: MENSAJE_VALOR_NO_PERMITIDO });

const NotaSchema = z.object({ matriculaId: IdSchema, competenciaPlanId: IdSchema, logro: LogroSchema });

export const GuardarNotasZod = z
  .object({
    notas: z
      .array(NotaSchema, { message: "Envía la lista de notas" })
      .min(1, "No hay notas que guardar")
      .max(MAXIMO_NOTAS_POR_GUARDADO, "Guarda como máximo 500 notas a la vez"),
  })
  .superRefine((datos, ctx) => {
    const vistas = new Set<string>();
    datos.notas.forEach((n, i) => {
      const clave = `${n.matriculaId}|${n.competenciaPlanId}`;
      if (vistas.has(clave)) {
        ctx.addIssue({ code: "custom", path: ["notas", i], message: "La misma nota aparece dos veces" });
      }
      vistas.add(clave);
    });
  });

/**
 * Cuerpo de PUT …/notas. Si lo único que falla es el logro de alguna celda, responde VALOR_NO_PERMITIDO con «Solo se
 * permiten los valores AD, A, B o C» y las celdas rechazadas; cualquier otro problema, DATOS_INVALIDOS (Zod).
 * Se usa con leerCuerpo: leerCuerpo(req, esquemasEvaluacion.GuardarNotasSchema).
 */
export const GuardarNotasSchema = {
  parse(valor: unknown): { notas: NotaPedida[] } {
    const r = GuardarNotasZod.safeParse(valor);
    if (r.success) return r.data;
    const soloLogros = r.error.issues.every((i) => i.path.length === 3 && i.path[2] === "logro");
    if (soloLogros) {
      const notas = (valor as { notas: { matriculaId: string; competenciaPlanId: string; logro: unknown }[] }).notas;
      const indices = [...new Set(r.error.issues.map((i) => Number(i.path[1])))];
      throw E.valorNoPermitido(
        indices.map((i) => ({
          matriculaId: notas[i].matriculaId,
          competenciaPlanId: notas[i].competenciaPlanId,
          valor: String(notas[i].logro ?? ""),
        })),
      );
    }
    throw r.error;
  },
};

// ---------- Publicación (US39) y libreta (US46, US51, US66) ----------

const IdOpcional = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(IdSchema.optional());

/** Query de GET /publicaciones: año (por defecto, el que está en curso), bimestre, grado, sección y curso. */
export const FiltroPublicacionSchema = z.object({
  anioId: IdOpcional,
  periodoId: IdOpcional,
  gradoId: IdOpcional,
  seccionId: IdOpcional,
  cursoId: IdOpcional,
});

/** Un año tiene unas 40 secciones por 10 cursos y 4 bimestres; 200 registros a la vez sobran. */
const MAXIMO_REGISTROS_POR_PUBLICACION = 200;

/** Cuerpo de POST /publicaciones: los registros cerrados que se publican («Publicar» o «Publicar seleccionados»). */
export const PublicarNotasSchema = z.object({
  cierreIds: z
    .array(IdSchema, { message: "Envía la lista de registros" })
    .min(1, "Elige al menos un registro para publicar")
    .max(MAXIMO_REGISTROS_POR_PUBLICACION, "Publica como máximo 200 registros a la vez"),
});

/** Query de la libreta en PDF: el bimestre que se descarga. */
export const LibretaPdfSchema = z.object({ periodoId: IdSchema });

// ---------- Rectificación de nota (US41) y bitácora de notas (US03) ----------

const MotivoSchema = (vacio: string) =>
  z
    .string({ message: vacio })
    .trim()
    .min(1, vacio)
    .max(LARGO_MAXIMO_MOTIVO, `El motivo admite como máximo ${LARGO_MAXIMO_MOTIVO} caracteres`);

/** Cuerpo de POST …/rectificaciones (M-08): estudiante, competencia, valor correcto y motivo, todos obligatorios. */
export const SolicitarRectificacionSchema = z.object({
  matriculaId: IdSchema,
  competenciaPlanId: IdSchema,
  valorCorrecto: LogroSchema,
  motivo: MotivoSchema("Escribe el motivo del error"),
});

/** Cuerpo de POST /rectificaciones/{id}/rechazar: el motivo del rechazo es obligatorio (US41, criterio 3). */
export const RechazarRectificacionSchema = z.object({ motivo: MotivoSchema("Escribe el motivo del rechazo") });

/** Query de GET /rectificaciones (bandeja de AD-15). */
export const BandejaRectificacionesSchema = z.object({
  estado: z.enum(["PENDIENTES", "RESUELTAS"], { message: "Estado no válido" }).default("PENDIENTES"),
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(100).default(20),
});

const FechaDiaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida")
  .refine((v) => new Date(`${v}T00:00:00.000Z`).toISOString().startsWith(v), "Fecha no válida");

const FechaOpcional = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(FechaDiaSchema.optional());

/** Query de GET /bitacora (AD-16 «Cambios de notas»): fechas «AAAA-MM-DD» de Lima, docente y página. */
export const FiltroBitacoraSchema = z.object({
  desde: FechaOpcional,
  hasta: FechaOpcional,
  docenteId: IdOpcional,
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(100).default(20),
});
