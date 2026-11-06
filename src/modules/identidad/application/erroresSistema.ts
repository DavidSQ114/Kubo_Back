// identidad/application: log de errores del sistema (US05, AD-16 «Errores del sistema»), de solo lectura para el
// Administrador. Lee log_error con platform/soporte y agrega el correo del usuario que originó la petición.
import { listarLogErrores, logErrorPorId, type FiltroLogErrores, type NivelLog } from "@/platform/soporte";
import { errores } from "@/platform/http/errores";
import { usuarios } from "../infrastructure/repositorio";

/** Lima no tiene horario de verano: siempre UTC−5. */
const DESFASE_LIMA = "-05:00";

const inicioDelDia = (fecha: string) => new Date(`${fecha}T00:00:00.000${DESFASE_LIMA}`);
/** Día siguiente a las 00:00 en Lima: el filtro «hasta» incluye todo ese día. */
const finDelDia = (fecha: string) => new Date(inicioDelDia(fecha).getTime() + 24 * 60 * 60 * 1000);

export interface FiltroErroresSistema {
  /** «AAAA-MM-DD» en Lima. */
  desde?: string;
  hasta?: string;
  nivel?: NivelLog;
  codigoHttp?: number;
  pagina: number;
  tamano: number;
}

async function correos(ids: (string | null)[]): Promise<Record<string, string>> {
  const unicos = [...new Set(ids.filter((x): x is string => !!x))];
  if (!unicos.length) return {};
  const filas = await usuarios.correosPorIds(unicos);
  return Object.fromEntries(filas.map((u) => [u.id, u.email]));
}

/** Registros del log de errores con filtros por fecha (de Lima), nivel y código HTTP, paginados. */
export async function listarErroresSistema(f: FiltroErroresSistema) {
  const filtro: FiltroLogErrores = {
    desde: f.desde ? inicioDelDia(f.desde) : undefined,
    hasta: f.hasta ? finDelDia(f.hasta) : undefined,
    nivel: f.nivel,
    codigoHttp: f.codigoHttp,
    pagina: f.pagina,
    tamano: f.tamano,
  };
  const { items, total } = await listarLogErrores(filtro);
  const porUsuario = await correos(items.map((i) => i.usuarioId));
  return {
    items: items.map((i) => ({ ...i, usuario: i.usuarioId ? (porUsuario[i.usuarioId] ?? null) : null })),
    paginacion: { pagina: f.pagina, tamano: f.tamano, total, paginas: Math.ceil(total / f.tamano) },
  };
}

/** Detalle de un registro con su stack trace completo. */
export async function detalleErrorSistema(id: string) {
  const r = await logErrorPorId(id);
  if (!r) throw errores.noEncontrado("El registro del log");
  const porUsuario = await correos([r.usuarioId]);
  return { ...r, usuario: r.usuarioId ? (porUsuario[r.usuarioId] ?? null) : null };
}
