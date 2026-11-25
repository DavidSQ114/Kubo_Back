// Parámetros del sistema (bloque M1) · portal del Administrador: parámetros generales de parametro_institucion con su
// descripción, agrupados por tema, y edición con validación por tipo (hora HH:MM, entero, decimal entre 0 y 1, monto).
// Cada cambio queda en la auditoría (ACTUALIZAR_PARAMETRO). Los montos de cada año los fija el Coordinador académico.
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { alertaError } from "@/components/admin/PortalAdmin";
import { Alerta, Boton, Spinner, Tarjeta } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { fechaHora } from "@/lib/formato";

type TipoParametro = "HORA" | "ENTERO" | "PROPORCION" | "MONTO";

interface ParametroSistema {
  clave: string;
  grupo: string;
  tipo: TipoParametro;
  descripcion: string;
  valor: string | null;
  minimo: number | null;
  maximo: number | null;
  actualizadoEn: string | null;
}

/** Ayuda bajo cada campo: qué formato espera. */
function ayuda(p: ParametroSistema): string {
  if (p.tipo === "HORA") return "Hora en formato HH:MM (24 horas), por ejemplo 07:30.";
  if (p.tipo === "ENTERO") return `Número entero entre ${p.minimo} y ${p.maximo}.`;
  if (p.tipo === "PROPORCION") return "Decimal mayor que 0 y menor que 1: 0.15 equivale a 15 %.";
  return "Monto en soles con hasta dos decimales, por ejemplo 350.00.";
}

export default function ParametrosPage() {
  const [parametros, setParametros] = useState<ParametroSistema[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    api<ParametroSistema[]>("/academico/parametros")
      .then((p) => vigente && setParametros(p))
      .catch((e) => vigente && setError(alertaError(e)));
    return () => {
      vigente = false;
    };
  }, [recarga]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  const grupos = parametros ? [...new Set(parametros.map((p) => p.grupo))] : [];

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <p className="text-[14px] leading-[1.4] text-texto-3">Institución / Parámetros del sistema</p>
        <h1 className="text-[32px] font-bold leading-[1.2] text-texto">Parámetros del sistema</h1>
        <p className="text-[16px] leading-[1.5] text-texto-2">
          Valores generales que usa Kubo: seguridad del inicio de sesión, jornada docente, asistencia y pagos. Cada
          cambio queda registrado en la auditoría.
        </p>
      </div>

      {aviso && <Alerta tipo="exito" icono="icon-check-verde" titulo={aviso} />}

      {error ? (
        <Alerta tipo="error" titulo="No pudimos cargar los parámetros">
          <p>{error}</p>
          <Boton
            variante="secundario"
            onClick={() => {
              setError(null);
              setRecarga((r) => r + 1);
            }}
          >
            Reintentar
          </Boton>
        </Alerta>
      ) : !parametros ? (
        <Tarjeta className="flex items-center justify-center gap-3 p-12 text-[14px] text-texto-2">
          <Spinner claro={false} /> Cargando…
        </Tarjeta>
      ) : !parametros.length ? (
        <Alerta tipo="info" titulo="No hay parámetros para mostrar">
          Los parámetros generales se cargan con el seed de la base de datos.
        </Alerta>
      ) : (
        grupos.map((grupo) => (
          <Tarjeta key={grupo} className="flex flex-col gap-1 p-6">
            <h2 className="pb-2 text-[20px] font-semibold leading-[1.3] text-texto">{grupo}</h2>
            {parametros
              .filter((p) => p.grupo === grupo)
              .map((p) => (
                <FilaParametro
                  key={p.clave}
                  parametro={p}
                  onGuardado={(actualizado) => {
                    setParametros(
                      (lista) => lista?.map((x) => (x.clave === actualizado.clave ? actualizado : x)) ?? null,
                    );
                    setAviso(`Se actualizó «${actualizado.descripcion}».`);
                  }}
                />
              ))}
          </Tarjeta>
        ))
      )}

      <Alerta tipo="info" titulo="Montos de cada año">
        Los montos de matrícula y pensión de un año los fija el coordinador académico en «Año y bimestres». Aquí se
        guardan los montos generales que se sugieren al configurar un año nuevo.
      </Alerta>
    </>
  );
}

function FilaParametro({
  parametro,
  onGuardado,
}: {
  parametro: ParametroSistema;
  onGuardado: (p: ParametroSistema) => void;
}) {
  const [valor, setValor] = useState(parametro.valor ?? "");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const cambiado = valor.trim() !== (parametro.valor ?? "");
  const id = `parametro-${parametro.clave}`;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!valor.trim()) {
      setError("Ingresa el valor.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const actualizado = await api<ParametroSistema>(`/academico/parametros/${parametro.clave}`, {
        method: "PUT",
        body: { valor: valor.trim() },
      });
      setValor(actualizado.valor ?? "");
      onGuardado(actualizado);
    } catch (err) {
      setError(
        err instanceof ApiError && err.codigo === "DATOS_INVALIDOS"
          ? (Object.values((err.detalles ?? {}) as Record<string, string>)[0] ?? err.message)
          : alertaError(err),
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form
      onSubmit={guardar}
      className="flex flex-wrap items-start gap-x-6 gap-y-2 border-t border-borde py-4 first-of-type:border-t-0"
      noValidate
    >
      <div className="flex min-w-[240px] flex-1 flex-col gap-0.5">
        <label htmlFor={id} className="text-[15px] font-semibold leading-[1.4] text-texto">
          {parametro.descripcion}
        </label>
        <p className="text-[12px] leading-[1.4] text-texto-3">
          {parametro.clave}
          {parametro.actualizadoEn
            ? ` · actualizado el ${fechaHora(new Date(parametro.actualizadoEn))}`
            : " · sin configurar"}
        </p>
      </div>
      <div className="flex w-full flex-col gap-1 sm:w-[260px]">
        <div className="flex gap-2">
          {parametro.tipo === "MONTO" && <span className="self-center text-[15px] text-texto-2">S/</span>}
          <input
            id={id}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputMode={parametro.tipo === "HORA" ? "text" : parametro.tipo === "ENTERO" ? "numeric" : "decimal"}
            placeholder={parametro.tipo === "HORA" ? "HH:MM" : undefined}
            aria-invalid={Boolean(error)}
            aria-describedby={`${id}-ayuda`}
            maxLength={20}
            className={`min-w-0 flex-1 rounded-lg border bg-white px-3 py-2.5 text-[16px] text-texto outline-none focus:ring-1 ${error ? "border-rojo focus:ring-rojo" : "border-borde focus:border-kubo-azul focus:ring-kubo-azul"}`}
          />
          <Boton type="submit" cargando={guardando} disabled={!cambiado}>
            Guardar
          </Boton>
        </div>
        <p id={`${id}-ayuda`} className={`text-[12px] leading-[1.4] ${error ? "text-rojo" : "text-texto-3"}`}>
          {error ?? ayuda(parametro)}
        </p>
      </div>
    </form>
  );
}
