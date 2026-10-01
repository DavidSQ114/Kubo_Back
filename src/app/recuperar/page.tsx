// AC-04 · Recuperar contraseña
"use client";

import { useState, type FormEvent } from "react";
import { EncabezadoTarjeta, IconoCircular, PaginaCentrada, TarjetaAcceso, VolverAlLogin } from "@/components/acceso";
import { Alerta, Boton, Campo } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await api("/identidad/password/recuperar", { method: "POST", body: { email } });
      setEnviado(true);
    } catch (err) {
      setError(err instanceof ApiError && err.codigo === "DATOS_INVALIDOS" ? "Ingresa un correo válido." : (err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <PaginaCentrada>
      <TarjetaAcceso>
        <VolverAlLogin />
        <IconoCircular nombre="icon-key" />
        <EncabezadoTarjeta titulo="Recupera tu contraseña">
          Ingresa el correo electrónico registrado. Te enviaremos un enlace único para crear una nueva contraseña.
        </EncabezadoTarjeta>
        <form onSubmit={enviar} className="flex w-full flex-col gap-5" noValidate>
          <Campo
            etiqueta="Correo electrónico registrado"
            obligatorio
            icono="icon-mail"
            type="email"
            autoComplete="email"
            placeholder="nombre.apellido@kubo.edu.pe"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error ?? undefined}
          />
          <Boton type="submit" icono="icon-send" ancho cargando={enviando} disabled={!email}>
            Enviar enlace de recuperación
          </Boton>
        </form>
        {enviado && (
          <Alerta tipo="exito" titulo="Solicitud enviada">
            Si el correo existe, recibirás un enlace de recuperación. El enlace vence en 30 minutos.
          </Alerta>
        )}
      </TarjetaAcceso>
    </PaginaCentrada>
  );
}
