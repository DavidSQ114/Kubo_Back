// POST /api/v1/identidad/refresh · Renovar el token de acceso con el refresh token (RNF02)
// Si la sesión ya no es válida, responde 401 y borra las cookies para que el frontend vaya al login.
import "@/server/wiring";
import { NextResponse } from "next/server";
import { ok, ruta } from "@/platform/http/ruta";
import { ErrorApp } from "@/platform/http/errores";
import { borrarCookiesSesion, escribirCookiesSesion, leerRefresh } from "@/platform/auth/cookies";
import { renovarSesion } from "@/modules/identidad";

export const POST = ruta(async (req) => {
  try {
    const tokens = await renovarSesion(leerRefresh(req));
    const res = ok({ renovado: true });
    escribirCookiesSesion(res, tokens);
    return res;
  } catch (e) {
    if (e instanceof ErrorApp && e.estadoHttp === 401) {
      const res = NextResponse.json({ error: { code: e.codigo, message: e.message, details: {} } }, { status: 401 });
      borrarCookiesSesion(res);
      return res;
    }
    throw e;
  }
});
