// Formatos de fecha para las tablas (zona horaria de Lima).

const ZONA = "America/Lima";

function partes(fecha: Date) {
  const f = new Intl.DateTimeFormat("es-PE", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(fecha);
  const v = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return { anio: v("year"), mes: v("month"), dia: v("day"), hora: `${v("hour")}:${v("minute")}` };
}

/** "16/09/2026 10:24" (pie de AC-07). */
export function fechaHora(fecha: Date): string {
  const p = partes(fecha);
  return `${p.dia}/${p.mes}/${p.anio} ${p.hora}`;
}

/** "Hoy, 07:41" · "Ayer, 20:15" · "14/09, 18:02" · "Nunca" (columna Último acceso de AD-06). */
export function ultimoAcceso(iso: string | null): string {
  if (!iso) return "Nunca";
  const fecha = partes(new Date(iso));
  const hoy = partes(new Date());
  const ayer = partes(new Date(Date.now() - 86_400_000));
  const clave = (p: ReturnType<typeof partes>) => `${p.anio}-${p.mes}-${p.dia}`;
  if (clave(fecha) === clave(hoy)) return `Hoy, ${fecha.hora}`;
  if (clave(fecha) === clave(ayer)) return `Ayer, ${fecha.hora}`;
  if (fecha.anio === hoy.anio) return `${fecha.dia}/${fecha.mes}, ${fecha.hora}`;
  return `${fecha.dia}/${fecha.mes}/${fecha.anio}`;
}

/** "14:32" a partir de una fecha futura. */
export function cuentaRegresiva(hasta: Date, ahora: Date): string {
  const s = Math.max(0, Math.round((hasta.getTime() - ahora.getTime()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
