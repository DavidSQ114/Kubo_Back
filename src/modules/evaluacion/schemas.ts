// evaluacion/schemas: validación de las entradas de la API del registro de notas (US37, US39, US40), de la
// rectificación de nota (US41), de la bitácora de notas (US03), de las evidencias pedagógicas (US38) y de los ítems de
// evaluación con pesos (bloque M2), RNF16.
// Mensajes en español; un logro fuera de la escala responde con el mensaje del backlog (US37, criterio 2).
import { z } from "zod";
import { erroresEvaluacion as E, MENSAJE_VALOR_NO_PERMITIDO } from "./domain/errores";
import { largoEnCaracteres, LARGO_MAXIMO_COMENTARIO_EVIDENCIA } from "./domain/evidencias";
import { MAXIMO_ITEMS_POR_COMPETENCIA, type CalificacionPedida } from "./domain/items";
import { LOGROS_NOTA, type NotaPedida } from "./domain/notas";
import { LARGO_MAXIMO_MOTIVO } from "./domain/rectificacion";

export const IdSchema = z.string().uuid("Identificador no válido");

/** Ruta /registros/{asignacionId}/bimestres/{periodoId}. */
export const RegistroParamsSchema = z.object({ asignacionId: IdSchema, periodoId: IdSchema });

/** Una sección tiene a lo más unos 40 alumnos y un curso unas 6 competencias: 500 celdas sobran. */
const MAXIMO_NOTAS_POR_GUARDADO = 500;

const LogroSchema = z.enum(LOGROS_NOTA, { message: MENSAJE_VALOR_NO_PERMITIDO });

/** 40 alumnos × 20 ítems × unas 3 competencias con ítems: 2000 calificaciones a la vez sobran (bloque M2). */
const MAXIMO_CALIFICACIONES_POR_GUARDADO = 2000;

const NotaSchema = z.object({ matriculaId: IdSchema, competenciaPlanId: IdSchema, logro: LogroSchema });
const CalificacionItemSchema = z.object({ itemId: IdSchema, matriculaId: IdSchema, logro: LogroSchema });

export const GuardarNotasZod = z
  .object({
    notas: z
      .array(NotaSchema, { message: "Envía la lista de notas" })
      .max(MAXIMO_NOTAS_POR_GUARDADO, "Guarda como máximo 500 notas a la vez")
      .default([]),
    calificaciones: z
      .array(CalificacionItemSchema, { message: "Envía la lista de calificaciones de ítems" })
      .max(MAXIMO_CALIFICACIONES_POR_GUARDADO, "Guarda como máximo 2000 calificaciones de ítems a la vez")
      .default([]),
  })
  .superRefine((datos, ctx) => {
    if (datos.notas.length === 0 && datos.calificaciones.length === 0) {
      ctx.addIssue({ code: "custom", path: ["notas"], message: "No hay notas que guardar" });
    }
    const vistas = new Set<string>();
    datos.notas.forEach((n, i) => {
      const clave = `${n.matriculaId}|${n.competenciaPlanId}`;
      if (vistas.has(clave)) {
        ctx.addIssue({ code: "custom", path: ["notas", i], message: "La misma nota aparece dos veces" });
      }
      vistas.add(clave);
    });
    datos.calificaciones.forEach((c, i) => {
      const clave = `${c.matriculaId}|item:${c.itemId}`;
      if (vistas.has(clave)) {
        ctx.addIssue({
          code: "custom",
          path: ["calificaciones", i],
          message: "La misma calificación aparece dos veces",
        });
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
  parse(valor: unknown): { notas: NotaPedida[]; calificaciones: CalificacionPedida[] } {
    const r = GuardarNotasZod.safeParse(valor);
    if (r.success) return r.data;
    const soloLogros = r.error.issues.every((i) => i.path.length === 3 && i.path[2] === "logro");
    if (soloLogros) {
      type Celda = { matriculaId: string; competenciaPlanId?: string; itemId?: string; logro: unknown };
      const cuerpo = valor as { notas?: Celda[]; calificaciones?: Celda[] };
      const vistas = new Set<string>();
      const celdas = r.error.issues.flatMap((issue) => {
        const lista = issue.path[0] === "calificaciones" ? cuerpo.calificaciones : cuerpo.notas;
        const clave = `${String(issue.path[0])}|${String(issue.path[1])}`;
        const celda = lista?.[Number(issue.path[1])];
        if (!celda || vistas.has(clave)) return [];
        vistas.add(clave);
        return [
          {
            matriculaId: celda.matriculaId,
            competenciaPlanId: celda.competenciaPlanId ?? "",
            ...(celda.itemId ? { itemId: celda.itemId } : {}),
            valor: String(celda.logro ?? ""),
          },
        ];
      });
      throw E.valorNoPermitido(celdas);
    }
    throw r.error;
  },
};

// ---------- Ítems de evaluación (bloque M2) ----------

/** Ruta /registros/{asignacionId}/bimestres/{periodoId}/competencias/{competenciaPlanId}/items. */
export const ItemsParamsSchema = RegistroParamsSchema.extend({ competenciaPlanId: IdSchema });

/**
 * Cuerpo de PUT …/items: la lista completa de ítems de la competencia, en orden (los que no van se eliminan). El largo
 * del nombre, los pesos y los duplicados los valida domain/items con mensajes por ítem.
 */
export const GuardarItemsSchema = z.object({
  items: z
    .array(
      z.object({
        id: IdSchema.optional(),
        nombre: z.string({ message: "Escribe el nombre de cada ítem" }).max(200, "Nombre de ítem demasiado largo"),
        peso: z.number({ message: "El peso de cada ítem debe ser un número" }),
      }),
      { message: "Envía la lista de ítems" },
    )
    .max(MAXIMO_ITEMS_POR_COMPETENCIA, `Una competencia admite como máximo ${MAXIMO_ITEMS_POR_COMPETENCIA} ítems`),
  confirmar: z.boolean({ message: "confirmar debe ser verdadero o falso" }).default(false),
});

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

// ---------- Evidencias pedagógicas (US38) ----------

/** Ruta /registros/{asignacionId}/bimestres/{periodoId}/evidencias/{evidenciaId}. */
export const EvidenciaParamsSchema = RegistroParamsSchema.extend({ evidenciaId: IdSchema });

/**
 * Campos de texto del formulario de POST …/evidencias (multipart/form-data). El archivo no pasa por aquí: se valida por
 * su contenido (tipo real y tamaño) en platform/archivos. Un comentario vacío cuenta como «sin comentario».
 */
export const NuevaEvidenciaSchema = z.object({
  matriculaId: IdSchema,
  competenciaPlanId: IdSchema,
  comentario: z
    .string({ message: "El comentario debe ser texto" })
    .nullish()
    .transform((v) => v ?? null)
    .refine(
      (v) => v === null || largoEnCaracteres(v.trim()) <= LARGO_MAXIMO_COMENTARIO_EVIDENCIA,
      `El comentario admite hasta ${LARGO_MAXIMO_COMENTARIO_EVIDENCIA} caracteres`,
    ),
});

/** Ruta /registros/{asignacionId}/bimestres/{periodoId}/items/{itemId}/importar. */
export const ImportarItemParamsSchema = RegistroParamsSchema.extend({ itemId: IdSchema });

/** 300 filas «dni,calificativo» ocupan unos 4 KB; 50 KB sobran. */
const LARGO_MAXIMO_CSV = 50_000;

/** Cuerpo de POST …/importar: el texto del CSV y si se guardan ya las filas válidas. */
export const ImportarCalificacionesSchema = z.object({
  csv: z
    .string({ message: "Envía el contenido del archivo CSV" })
    .max(LARGO_MAXIMO_CSV, "El archivo es demasiado grande: usa uno de hasta 300 filas"),
  confirmar: z.boolean({ message: "confirmar debe ser verdadero o falso" }).default(false),
});
