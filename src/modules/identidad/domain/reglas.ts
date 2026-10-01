// identidad/domain: reglas puras (sin Prisma ni Next.js), fáciles de probar.

export const ROLES = ["ADMINISTRADOR", "DOCENTE", "APODERADO", "ALUMNO"] as const;
export type Rol = (typeof ROLES)[number];

export const ESTADOS_USUARIO = ["PENDIENTE_ACTIVACION", "ACTIVO", "SUSPENDIDO", "DADO_DE_BAJA"] as const;
export type EstadoUsuario = (typeof ESTADOS_USUARIO)[number];

export const esRol = (v: unknown): v is Rol => typeof v === "string" && (ROLES as readonly string[]).includes(v);

/** Estados que permiten iniciar sesión. PENDIENTE_ACTIVACION entra, pero debe cambiar su contraseña primero. */
export const puedeIniciarSesion = (estado: string) => estado === "ACTIVO" || estado === "PENDIENTE_ACTIVACION";

// ---------- Contraseñas (pantalla AC-06: mínimo 8, una mayúscula y un número) ----------
export const LARGO_MINIMO_PASSWORD = 8;
export const LARGO_MAXIMO_PASSWORD = 72; // límite de bcrypt

export function incumplimientosPassword(password: string): string[] {
  const fallas: string[] = [];
  if (password.length < LARGO_MINIMO_PASSWORD) fallas.push("Mínimo 8 caracteres");
  if (Buffer.byteLength(password, "utf8") > LARGO_MAXIMO_PASSWORD) fallas.push("Máximo 72 caracteres");
  if (!/[A-ZÁÉÍÓÚÑ]/.test(password)) fallas.push("Al menos una mayúscula");
  if (!/[0-9]/.test(password)) fallas.push("Al menos un número");
  return fallas;
}

/** Contraseña temporal para cuentas creadas por el Administrador (RF43): 12 caracteres, cumple la política. */
export function generarPasswordTemporal(aleatorio: (max: number) => number): string {
  const mayus = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const minus = "abcdefghijkmnpqrstuvwxyz";
  const nums = "23456789";
  const todos = mayus + minus + nums;
  const chars = [mayus[aleatorio(mayus.length)], nums[aleatorio(nums.length)], minus[aleatorio(minus.length)]];
  while (chars.length < 12) chars.push(todos[aleatorio(todos.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = aleatorio(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// ---------- Bloqueo por intentos fallidos (RF01) ----------
export interface ResultadoIntentoFallido {
  intentosFallidos: number;
  bloqueadoHasta: Date | null;
}

export function registrarIntentoFallido(
  intentosPrevios: number,
  maxIntentos: number,
  minutosBloqueo: number,
  ahora: Date,
): ResultadoIntentoFallido {
  const intentos = intentosPrevios + 1;
  if (intentos >= maxIntentos) {
    return { intentosFallidos: 0, bloqueadoHasta: new Date(ahora.getTime() + minutosBloqueo * 60_000) };
  }
  return { intentosFallidos: intentos, bloqueadoHasta: null };
}

export function minutosRestantes(bloqueadoHasta: Date, ahora: Date): number {
  return Math.max(1, Math.ceil((bloqueadoHasta.getTime() - ahora.getTime()) / 60_000));
}

export const normalizarEmail = (email: string) => email.trim().toLowerCase();

// ---------- Duraciones ----------
export const HORAS_SESION_SIN_RECORDAR = 12;
export const DIAS_SESION_RECORDADA = 7;
export const MINUTOS_ENLACE_RECUPERACION = 30;

export function expiracionSesion(recordar: boolean, ahora: Date): Date {
  const ms = recordar ? DIAS_SESION_RECORDADA * 86_400_000 : HORAS_SESION_SIN_RECORDAR * 3_600_000;
  return new Date(ahora.getTime() + ms);
}
