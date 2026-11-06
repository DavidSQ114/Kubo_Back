// platform/soporte: lectura del log de errores (tabla log_error, US05) para la pantalla de solo lectura del
// Administrador. La escritura la hace ruta() en platform/http. Nada aquí modifica ni borra registros.
import { prisma } from "@/platform/db/prisma";

export const NIVELES_LOG = ["INFO", "WARN", "ERROR", "FATAL"] as const;
export type NivelLog = (typeof NIVELES_LOG)[number];

export interface FiltroLogErrores {
  /** Instantes en UTC (el caso de uso convierte las fechas de Lima). */
  desde?: Date;
  hasta?: Date;
  nivel?: NivelLog;
  codigoHttp?: number;
  pagina: number;
  tamano: number;
}

export interface LogErrorResumen {
  id: string;
  fecha: Date;
  nivel: NivelLog;
  codigoHttp: number;
  metodoHttp: string | null;
  endpoint: string;
  mensaje: string;
  requestId: string | null;
  usuarioId: string | null;
  tieneStack: boolean;
}

const filtroWhere = (f: FiltroLogErrores) => ({
  ...(f.desde || f.hasta
    ? { fecha: { ...(f.desde ? { gte: f.desde } : {}), ...(f.hasta ? { lt: f.hasta } : {}) } }
    : {}),
  ...(f.nivel ? { nivel: f.nivel } : {}),
  ...(f.codigoHttp ? { codigoHttp: f.codigoHttp } : {}),
});

/** Registros del log de errores, del más reciente al más antiguo, paginados. */
export async function listarLogErrores(f: FiltroLogErrores) {
  const where = filtroWhere(f);
  const [filas, total] = await Promise.all([
    prisma.logError.findMany({
      where,
      orderBy: { fecha: "desc" },
      skip: (f.pagina - 1) * f.tamano,
      take: f.tamano,
      select: {
        id: true,
        fecha: true,
        nivel: true,
        codigoHttp: true,
        metodoHttp: true,
        endpoint: true,
        mensaje: true,
        requestId: true,
        usuarioId: true,
        stackTrace: true,
      },
    }),
    prisma.logError.count({ where }),
  ]);
  const items: LogErrorResumen[] = filas.map(({ stackTrace, ...f }) => ({ ...f, tieneStack: Boolean(stackTrace) }));
  return { items, total };
}

/** Un registro con su stack trace completo, o null. */
export const logErrorPorId = (id: string) =>
  prisma.logError.findUnique({
    where: { id },
    select: {
      id: true,
      fecha: true,
      nivel: true,
      codigoHttp: true,
      metodoHttp: true,
      endpoint: true,
      mensaje: true,
      stackTrace: true,
      requestId: true,
      usuarioId: true,
      ipOrigen: true,
      metadatos: true,
    },
  });
