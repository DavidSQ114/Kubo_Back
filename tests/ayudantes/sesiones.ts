// Ayudantes de las pruebas de integración (bloque M1): cuentas de prueba con un perfil de gestión (Administrador o
// Coordinador académico) que inician sesión de verdad, y una forma corta de llamar a un route.ts con su token.
// Solo datos ficticios. Una cuenta que queda como actor en registro_auditoria ya no se puede borrar (bitácora
// inmutable): úsalas solo en lecturas y rechazos, que no auditan.
import { NextRequest } from "next/server";
import { hashPassword } from "@/platform/auth/tokens";
import { prisma } from "@/platform/db/prisma";
import { iniciarSesion } from "@/modules/identidad";

export type PerfilGestion = "ADMINISTRADOR" | "COORDINADOR";

export interface CuentaDePrueba {
  personaId: string;
  usuarioId: string;
  email: string;
  token: string;
}

const meta = { requestId: `prueba-sesiones-${Date.now()}`, ip: null, userAgent: null };

/** Persona con un solo perfil de gestión, su cuenta activa y un token de acceso de una sesión real. */
export async function crearCuentaDePrueba(datos: {
  perfil: PerfilGestion;
  dni: string;
  nombres: string;
  apellidos: string;
  clave: string;
}): Promise<CuentaDePrueba> {
  const email = `${datos.dni}@prueba.kubo.test`;
  const perfil = datos.perfil === "ADMINISTRADOR" ? { administrador: { create: {} } } : { coordinador: { create: {} } };
  const persona = await prisma.persona.create({
    data: { dni: datos.dni, nombres: datos.nombres, apellidos: datos.apellidos, email, ...perfil },
  });
  const usuario = await prisma.usuario.create({
    data: {
      personaId: persona.id,
      email,
      passwordHash: await hashPassword(datos.clave),
      estado: "ACTIVO",
      debeCambiarPassword: false,
    },
  });
  const r = await iniciarSesion({ email, password: datos.clave, recordar: false }, meta);
  if (r.tipo !== "SESION") throw new Error("La cuenta de prueba debe tener un solo perfil");
  return { personaId: persona.id, usuarioId: usuario.id, email, token: r.tokens.acceso };
}

/** Sesión de un coordinador académico de prueba (el ayudante que piden las pruebas de accesos). */
export const crearSesionCoordinador = (dni: string, clave: string) =>
  crearCuentaDePrueba({ perfil: "COORDINADOR", dni, nombres: "Carmen", apellidos: "Coordinadora Prueba", clave });

/** Sesión de un administrador de prueba. */
export const crearSesionAdministrador = (dni: string, clave: string) =>
  crearCuentaDePrueba({ perfil: "ADMINISTRADOR", dni, nombres: "Rosa", apellidos: "Administradora Prueba", clave });

/** Borra las cuentas de prueba (sesiones, usuario, perfiles y persona). */
export async function borrarCuentasDePrueba(personaIds: string[]) {
  const usuarios = await prisma.usuario.findMany({ where: { personaId: { in: personaIds } }, select: { id: true } });
  await prisma.sesion.deleteMany({ where: { usuarioId: { in: usuarios.map((u) => u.id) } } });
  await prisma.usuario.deleteMany({ where: { personaId: { in: personaIds } } });
  await prisma.administrador.deleteMany({ where: { personaId: { in: personaIds } } });
  await prisma.coordinador.deleteMany({ where: { personaId: { in: personaIds } } });
  await prisma.persona.deleteMany({ where: { id: { in: personaIds } } });
}

type Manejador = (req: NextRequest, contexto: { params: Promise<Record<string, string>> }) => Promise<Response>;

/** Llama a un manejador de route.ts como lo haría el navegador, con el token en la cabecera Authorization. */
export async function pedir(
  manejador: Manejador,
  ruta: string,
  opciones: {
    token?: string;
    params?: Record<string, string>;
    metodo?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    cuerpo?: unknown;
  } = {},
) {
  const req = new NextRequest(`http://localhost/api/v1${ruta}`, {
    method: opciones.metodo ?? (opciones.cuerpo === undefined ? "GET" : "POST"),
    headers: opciones.token ? { authorization: `Bearer ${opciones.token}` } : undefined,
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
  });
  const res = await manejador(req, { params: Promise.resolve(opciones.params ?? {}) });
  const json = await res.json();
  return { estado: res.status, datos: json.data, error: json.error as { code: string; message: string } | undefined };
}
