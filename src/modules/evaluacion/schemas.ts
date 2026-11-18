// evaluacion/schemas: validación de las entradas de la API del registro de notas (US37, US39, US40), RNF16.
// Mensajes en español; un logro fuera de la escala responde con el mensaje del backlog (US37, criterio 2).
import { z } from "zod";
import { erroresEvaluacion as E, MENSAJE_VALOR_NO_PERMITIDO } from "./domain/errores";
import { LOGROS_NOTA, type NotaPedida } from "./domain/notas";

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
