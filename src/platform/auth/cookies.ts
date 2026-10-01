// platform/auth: cookies de sesión.
// - kubo_at: token de acceso (15 min), disponible para toda la aplicación.
// - kubo_rt: refresh token, solo viaja a /api/v1/identidad (renovar y cerrar sesión).
// Ambas httpOnly (el JavaScript del navegador no puede leerlas) y SameSite=Lax.
// También se acepta "Authorization: Bearer <token>" para probar con REST Client o Postman.
import type { NextRequest, NextResponse } from "next/server";
import { MINUTOS_ACCESS_TOKEN } from "./jwt";

export const COOKIE_ACCESO = "kubo_at";
export const COOKIE_REFRESH = "kubo_rt";
const RUTA_REFRESH = "/api/v1/identidad";

const seguro = () => process.env.NODE_ENV === "production";

export function escribirCookiesSesion(
  res: NextResponse,
  tokens: { acceso: string; refresh?: string; recordar?: boolean; refreshExpiraEn?: Date },
) {
  res.cookies.set(COOKIE_ACCESO, tokens.acceso, {
    httpOnly: true,
    secure: seguro(),
    sameSite: "lax",
    path: "/",
    maxAge: MINUTOS_ACCESS_TOKEN * 60,
  });
  if (tokens.refresh) {
    res.cookies.set(COOKIE_REFRESH, tokens.refresh, {
      httpOnly: true,
      secure: seguro(),
      sameSite: "lax",
      path: RUTA_REFRESH,
      // Con "Recordarme" la cookie sobrevive al cerrar el navegador; sin él, es de sesión del navegador.
      ...(tokens.recordar && tokens.refreshExpiraEn ? { expires: tokens.refreshExpiraEn } : {}),
    });
  }
}

export function borrarCookiesSesion(res: NextResponse) {
  res.cookies.set(COOKIE_ACCESO, "", { httpOnly: true, secure: seguro(), sameSite: "lax", path: "/", maxAge: 0 });
  res.cookies.set(COOKIE_REFRESH, "", { httpOnly: true, secure: seguro(), sameSite: "lax", path: RUTA_REFRESH, maxAge: 0 });
}

export function leerTokenAcceso(req: NextRequest): string | null {
  const cabecera = req.headers.get("authorization");
  if (cabecera?.toLowerCase().startsWith("bearer ")) return cabecera.slice(7).trim() || null;
  return req.cookies.get(COOKIE_ACCESO)?.value ?? null;
}

export function leerRefresh(req: NextRequest): string | null {
  return req.cookies.get(COOKIE_REFRESH)?.value ?? null;
}
