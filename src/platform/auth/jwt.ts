// platform/auth: firma y verificación de JWT (RNF02). Algoritmo HS256 con JWT_SECRET.
import { SignJWT, jwtVerify, errors as joseErrors } from "jose";

export const MINUTOS_ACCESS_TOKEN = 15;
export const MINUTOS_TOKEN_SELECCION = 5;

const EMISOR = "kubo";

function clave(): Uint8Array {
  const secreto = process.env.JWT_SECRET;
  if (!secreto || secreto.length < 32) {
    throw new Error("JWT_SECRET no está configurado o tiene menos de 32 caracteres");
  }
  return new TextEncoder().encode(secreto);
}

/** Token de acceso: identifica la sesión. Los permisos se vuelven a validar contra la base en cada solicitud. */
export interface ClaimsAcceso {
  sub: string; // usuarioId
  sid: string; // sesionId
  rol: string; // rol activo
}

/** Token temporal entre el login y la elección de perfil (usuarios con más de un perfil). */
export interface ClaimsSeleccion {
  sub: string; // usuarioId
  ver: number; // versionSesion del usuario al momento del login
  rec: boolean; // "Recordarme en este equipo"
}

export async function firmarAcceso(c: ClaimsAcceso): Promise<string> {
  return new SignJWT({ sid: c.sid, rol: c.rol, typ: "acceso" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(c.sub)
    .setIssuer(EMISOR)
    .setIssuedAt()
    .setExpirationTime(`${MINUTOS_ACCESS_TOKEN}m`)
    .sign(clave());
}

export async function firmarSeleccion(c: ClaimsSeleccion): Promise<string> {
  return new SignJWT({ ver: c.ver, rec: c.rec, typ: "seleccion" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(c.sub)
    .setIssuer(EMISOR)
    .setIssuedAt()
    .setExpirationTime(`${MINUTOS_TOKEN_SELECCION}m`)
    .sign(clave());
}

async function verificar(token: string, tipo: "acceso" | "seleccion") {
  try {
    const { payload } = await jwtVerify(token, clave(), { issuer: EMISOR, algorithms: ["HS256"] });
    if (payload.typ !== tipo || typeof payload.sub !== "string") return null;
    return payload;
  } catch (e) {
    if (e instanceof joseErrors.JOSEError) return null;
    throw e;
  }
}

export async function verificarAcceso(token: string): Promise<ClaimsAcceso | null> {
  const p = await verificar(token, "acceso");
  if (!p || typeof p.sid !== "string" || typeof p.rol !== "string") return null;
  return { sub: p.sub as string, sid: p.sid, rol: p.rol };
}

export async function verificarSeleccion(token: string): Promise<ClaimsSeleccion | null> {
  const p = await verificar(token, "seleccion");
  if (!p || typeof p.ver !== "number") return null;
  return { sub: p.sub as string, ver: p.ver, rec: p.rec === true };
}
