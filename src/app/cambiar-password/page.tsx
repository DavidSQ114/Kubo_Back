// AC-09 · Cambio de contraseña (obligatorio en el primer ingreso o voluntario). Pantalla "por diseñar":
// usa el mismo lenguaje visual de AC-06.
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { IconoCircular, PaginaCentrada, TarjetaAcceso } from "@/components/acceso";
import { Alerta, Badge, Boton, CampoPassword, ChecklistPassword, requisitosPassword, Spinner } from "@/components/ui";
import { api, ApiError, cerrarSesion, inicioPorRol, type Sesion } from "@/lib/api";

export default function CambiarPasswordPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Sesion>("/identidad/sesion")
      .then(setSesion)
      .catch(() => router.replace("/login"));
  }, [router]);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!sesion) return;
    setError(null);
    setEnviando(true);
    try {
      await api("/identidad/password", { method: "PUT", body: { actual, nueva, confirmacion } });
      router.replace(inicioPorRol(sesion.rolActivo));
    } catch (err) {
      if (err instanceof ApiError && err.codigo === "PASSWORD_DEBIL") {
        setError(`La nueva contraseña no cumple: ${(err.detalles.requisitos as string[]).join(", ").toLowerCase()}.`);
      } else setError((err as Error).message);
      setEnviando(false);
    }
  }

  async function salir() {
    await cerrarSesion();
    router.replace("/login");
  }

  if (!sesion) {
    return (
      <PaginaCentrada>
        <Spinner claro={false} />
      </PaginaCentrada>
    );
  }

  const obligatorio = sesion.debeCambiarPassword;
  const valido = actual.length > 0 && requisitosPassword(nueva, confirmacion).every((r) => r.ok);

  return (
    <PaginaCentrada>
      <TarjetaAcceso ancho={440}>
        {obligatorio && (
          <Badge tono="ambar" punto>
            Primer ingreso
          </Badge>
        )}
        <IconoCircular nombre="icon-lock-grande" />
        <div className="flex w-full flex-col gap-2">
          <h1 className="text-[24px] font-semibold leading-[1.25] text-texto">
            {obligatorio ? "Crea tu contraseña personal" : "Cambiar contraseña"}
          </h1>
          <p className="text-[14px] leading-[1.4] text-texto-2">
            {obligatorio
              ? "Por seguridad, reemplaza la contraseña temporal que te entregó el colegio antes de continuar."
              : "Al guardar, se cerrarán tus sesiones abiertas en otros equipos."}
          </p>
          <p className="text-[14px] leading-[1.4] text-texto-2">Cuenta: {sesion.usuario.email}</p>
        </div>
        <form onSubmit={guardar} className="flex w-full flex-col gap-[18px]" noValidate>
          <CampoPassword
            etiqueta={obligatorio ? "Contraseña temporal" : "Contraseña actual"}
            obligatorio
            autoComplete="current-password"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
          />
          <CampoPassword
            etiqueta="Nueva contraseña"
            obligatorio
            autoComplete="new-password"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
          />
          <CampoPassword
            etiqueta="Confirmar contraseña"
            obligatorio
            autoComplete="new-password"
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
          />
          <ChecklistPassword nueva={nueva} confirmacion={confirmacion} />
          {error && <Alerta tipo="error" titulo={error} />}
          <Boton type="submit" ancho cargando={enviando} disabled={!valido}>
            Guardar nueva contraseña
          </Boton>
        </form>
        {obligatorio ? (
          <button
            type="button"
            onClick={salir}
            className="text-[14px] font-semibold leading-[1.4] text-kubo-azul hover:underline"
          >
            Cerrar sesión
          </button>
        ) : (
          <button
            type="button"
            onClick={() => router.back()}
            className="text-[14px] font-semibold leading-[1.4] text-kubo-azul hover:underline"
          >
            Volver
          </button>
        )}
      </TarjetaAcceso>
    </PaginaCentrada>
  );
}
