// AC-01 Iniciar sesión · AC-02 credenciales incorrectas · AC-03 cuenta bloqueada · AC-08 elección de perfil.
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { PanelMarca } from "@/components/acceso";
import { Alerta, Boton, Campo, CampoPassword, Casilla, Icono, Logo } from "@/components/ui";
import { api, ApiError, inicioPorRol, NOMBRE_ROL, type Rol, type Sesion } from "@/lib/api";
import { cuentaRegresiva } from "@/lib/formato";

type RespuestaLogin =
  { tipo: "SESION"; sesion: Sesion } | { tipo: "SELECCION"; tokenSeleccion: string; perfiles: Rol[]; nombres: string };

const ICONO_PERFIL: Record<Rol, string> = {
  ADMINISTRADOR: "perfil-shield",
  DOCENTE: "perfil-book",
  APODERADO: "perfil-users",
  ALUMNO: "perfil-user",
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recordar, setRecordar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<{ titulo: string; texto: string } | null>(null);
  const [bloqueadoHasta, setBloqueadoHasta] = useState<Date | null>(null);
  const [ahora, setAhora] = useState(() => new Date());
  const [seleccion, setSeleccion] = useState<{ token: string; perfiles: Rol[]; nombres: string } | null>(null);

  // Si ya hay una sesión válida, ir directo al inicio del perfil.
  useEffect(() => {
    api<Sesion>("/identidad/sesion")
      .then((s) => router.replace(s.debeCambiarPassword ? "/cambiar-password" : inicioPorRol(s.rolActivo)))
      .catch(() => undefined);
  }, [router]);

  // Contador del bloqueo (AC-03: "Esperar 14:32 min").
  useEffect(() => {
    if (!bloqueadoHasta) return;
    const t = setInterval(() => {
      const n = new Date();
      setAhora(n);
      if (n >= bloqueadoHasta) {
        setBloqueadoHasta(null);
        setError(null);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [bloqueadoHasta]);

  function entrar(s: Sesion) {
    router.replace(s.debeCambiarPassword ? "/cambiar-password" : inicioPorRol(s.rolActivo));
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError({ titulo: "Revisa los datos ingresados", texto: "Ingresa tu correo y tu contraseña." });
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      const r = await api<RespuestaLogin>("/identidad/login", { method: "POST", body: { email, password, recordar } });
      if (r.tipo === "SELECCION") setSeleccion({ token: r.tokenSeleccion, perfiles: r.perfiles, nombres: r.nombres });
      else entrar(r.sesion);
    } catch (err) {
      mostrarError(err);
    } finally {
      setEnviando(false);
    }
  }

  function mostrarError(err: unknown) {
    if (err instanceof ApiError && err.codigo === "CUENTA_BLOQUEADA") {
      const hasta = new Date(String(err.detalles.bloqueadoHasta));
      setBloqueadoHasta(hasta);
      setAhora(new Date());
      setError({
        titulo: "Cuenta bloqueada temporalmente por seguridad",
        texto: `Intente nuevamente en ${err.detalles.minutosRestantes} minutos. Si olvidaste tu contraseña, puedes restablecerla.`,
      });
      return;
    }
    if (err instanceof ApiError && err.codigo === "CREDENCIALES_INVALIDAS") {
      setError({
        titulo: "Correo o contraseña incorrectos",
        texto:
          "Verifica tus datos e inténtalo nuevamente. Por seguridad, tras 5 intentos fallidos la cuenta se bloquea 15 minutos.",
      });
      return;
    }
    if (err instanceof ApiError && err.codigo === "DATOS_INVALIDOS") {
      setError({ titulo: "Revisa los datos ingresados", texto: Object.values(err.detalles).join(" ") });
      return;
    }
    setError({
      titulo: "No pudimos iniciar sesión",
      texto: err instanceof Error ? err.message : "Inténtalo nuevamente.",
    });
  }

  async function elegirPerfil(rol: Rol) {
    if (!seleccion) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await api<{ sesion: Sesion }>("/identidad/login/perfil", {
        method: "POST",
        body: { tokenSeleccion: seleccion.token, rol },
      });
      entrar(r.sesion);
    } catch (err) {
      if (err instanceof ApiError && err.codigo === "SELECCION_EXPIRADA") {
        setSeleccion(null);
        setPassword("");
      }
      mostrarError(err);
      setEnviando(false);
    }
  }

  const bloqueado = Boolean(bloqueadoHasta && bloqueadoHasta > ahora);

  return (
    <div className="flex min-h-screen bg-fondo">
      <PanelMarca />
      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="flex w-full max-w-[480px] flex-col items-start gap-5">
          <div className="mb-2 lg:hidden">
            <Logo />
          </div>

          {seleccion ? (
            <>
              <h1 className="text-[32px] font-bold leading-[1.2] text-texto">¿Con qué perfil deseas ingresar?</h1>
              <p className="text-[16px] leading-[1.5] text-texto-2">
                Hola{seleccion.nombres ? `, ${seleccion.nombres}` : ""}. Tu cuenta tiene más de un perfil. Podrás
                cambiarlo después sin cerrar sesión.
              </p>
              {error && (
                <Alerta tipo="error" titulo={error.titulo}>
                  {error.texto}
                </Alerta>
              )}
              <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                {seleccion.perfiles.map((rol) => (
                  <button
                    key={rol}
                    type="button"
                    disabled={enviando}
                    onClick={() => elegirPerfil(rol)}
                    className="flex items-center justify-center gap-2 rounded-md border border-borde bg-white px-3 py-2.5 text-[16px] font-bold leading-[1.5] tracking-[0.2px] text-texto transition hover:border-kubo-azul hover:bg-fondo disabled:opacity-60"
                  >
                    <Icono nombre={ICONO_PERFIL[rol]} size={20} />
                    {NOMBRE_ROL[rol]}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSeleccion(null)}
                className="text-[14px] font-semibold text-kubo-azul hover:underline"
              >
                Ingresar con otra cuenta
              </button>
            </>
          ) : (
            <form onSubmit={enviar} className="flex w-full flex-col items-start gap-5" noValidate>
              <h1 className="text-[32px] font-bold leading-[1.2] text-texto">Iniciar sesión</h1>
              <p className="text-[16px] leading-[1.5] text-texto-2">
                Ingresa con tu correo institucional o el usuario que te asignó el colegio.
              </p>

              {error && (
                <Alerta tipo={bloqueado ? "aviso" : "error"} titulo={error.titulo}>
                  {error.texto}
                </Alerta>
              )}

              <Campo
                etiqueta="Correo o usuario"
                icono="icon-mail"
                type="email"
                autoComplete="username"
                placeholder="nombre.apellido@kubo.edu.pe"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  // El bloqueo es de la cuenta anterior: con otro correo se puede volver a intentar.
                  if (bloqueadoHasta) {
                    setBloqueadoHasta(null);
                    setError(null);
                  }
                }}
                required
              />
              <CampoPassword
                etiqueta="Contraseña"
                autoComplete="current-password"
                placeholder="Ingresa tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <div className="flex w-full items-center">
                <Casilla etiqueta="Recordarme en este equipo" checked={recordar} onChange={setRecordar} />
                <div className="flex-1" />
                <Link
                  href="/recuperar"
                  className="text-[14px] font-semibold leading-[1.4] text-kubo-azul hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              <Boton type="submit" tamano="lg" ancho cargando={enviando} disabled={bloqueado}>
                {bloqueado && bloqueadoHasta
                  ? `Esperar ${cuentaRegresiva(bloqueadoHasta, ahora)} min`
                  : "Iniciar sesión"}
              </Boton>

              <div className="flex w-full items-start gap-2">
                <Icono nombre="icon-info" size={18} />
                <p className="flex-1 text-[13px] leading-[1.4] text-texto-3">
                  Tu perfil (administrador, docente, apoderado o alumno) se detecta automáticamente al ingresar.
                </p>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
