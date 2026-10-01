// platform/auth: tokens opacos (refresh y recuperación) y hash de contraseñas.
// - Contraseñas: bcrypt (coste 10), compatible con el hash del seed (pgcrypto).
// - Tokens aleatorios de 256 bits: en la base solo se guarda su SHA-256 (RNF03).
//   Con esa entropía, SHA-256 es seguro y permite buscar el token por su hash.
import { createHash, randomBytes } from "node:crypto";
import { compare, hash } from "bcryptjs";

const COSTE_BCRYPT = 10;
// Hash de una contraseña que no existe: se usa para que el login tarde lo mismo exista o no el correo.
const HASH_FICTICIO = "$2a$10$PrKQfKhTIuDbs8/7RBW5C.Ukb/w4/wdldDCsF0JtoX17dI8J5QOAC";

export const hashPassword = (password: string) => hash(password, COSTE_BCRYPT);

export async function verificarPassword(password: string, hashGuardado: string | null): Promise<boolean> {
  const ok = await compare(password, hashGuardado ?? HASH_FICTICIO);
  return hashGuardado ? ok : false;
}

export function generarTokenOpaco(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
