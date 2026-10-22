// AD-07 · Registrar docente y asignar cursos (US13, US14)
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { anioPorDefecto, type AnioAcademico } from "@/components/admin/anio";
import type { Area } from "@/components/admin/cursos";
import {
  AccesoSistema,
  CargaAcademica,
  cuerpoDocente,
  DatosPersonales,
  DOCENTE_VACIO,
  erroresDeRegistro,
  validarDocente,
  VistaPreviaCorreo,
  type DatosDocente,
  type DocenteRegistrado,
} from "@/components/admin/docentes";
import type { Docente } from "@/components/admin/grados";
import { alertaError } from "@/components/admin/PortalAdmin";
import { Alerta, Boton, Icono, Spinner, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";

interface Catalogos {
  anios: AnioAcademico[];
  especialidades: string[];
  docentes: Docente[];
}

export default function RegistrarDocentePage() {
  const router = useRouter();
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [errorCatalogos, setErrorCatalogos] = useState<string | null>(null);
  const [datos, setDatos] = useState<DatosDocente>(DOCENTE_VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [enviarCorreo, setEnviarCorreo] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [registrado, setRegistrado] = useState<DocenteRegistrado | null>(null);
  const [docenteId, setDocenteId] = useState("");
  const [anioElegido, setAnioElegido] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      try {
        const [anios, areas, docentes] = await Promise.all([
          api<AnioAcademico[]>("/academico/anios"),
          api<Area[]>("/academico/areas"),
          api<Docente[]>("/comunidad/docentes"),
        ]);
        // la especialidad se elige entre las áreas curriculares, sin las competencias transversales
        const especialidades = areas.filter((a) => a.codigo !== "TRV").map((a) => a.nombre);
        setCatalogos({ anios, especialidades, docentes });
      } catch (e) {
        setErrorCatalogos(alertaError(e));
      }
    }
    void cargar();
  }, []);

  const anio = catalogos
    ? (catalogos.anios.find((a) => a.id === anioElegido) ?? anioPorDefecto(catalogos.anios))
    : undefined;

  async function registrar() {
    setGeneral(null);
    const e = validarDocente(datos);
    setErrores(e);
    if (Object.keys(e).length) return;
    setEnviando(true);
    try {
      const r = await api<DocenteRegistrado>("/comunidad/docentes", {
        method: "POST",
        body: cuerpoDocente(datos, enviarCorreo),
      });
      setRegistrado(r);
      setDocenteId(r.docenteId);
      const docentes = await api<Docente[]>("/comunidad/docentes");
      setCatalogos((c) => c && { ...c, docentes });
    } catch (err) {
      const r = erroresDeRegistro(err);
      setErrores(r.campos);
      setGeneral(r.general);
    } finally {
      setEnviando(false);
    }
  }

  if (errorCatalogos) {
    return (
      <Alerta tipo="error" titulo="No pudimos cargar el formulario">
        {errorCatalogos}
      </Alerta>
    );
  }
  if (!catalogos) {
    return (
      <Tarjeta className="flex items-center justify-center gap-3 p-12 text-[14px] text-texto-2">
        <Spinner claro={false} /> Cargando…
      </Tarjeta>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Link
          href="/admin/usuarios"
          className="flex w-fit items-center gap-2 text-[14px] font-semibold text-kubo-azul hover:underline"
        >
          <Icono nombre="icon-back" size={16} /> Volver a Usuarios
        </Link>
        <h1 className="mt-3 text-[32px] font-bold leading-[1.2] text-texto">Registrar docente</h1>
        <p className="text-[16px] leading-[1.5] text-texto-2">
          Crea la cuenta del docente y asígnale los cursos y secciones que dictará
          {anio ? ` en ${anio.anio}` : ""}.
        </p>
      </div>

      {registrado && (
        <Alerta tipo="exito" icono="icon-check-verde" titulo={`${registrado.nombreCompleto} ya es docente`}>
          {registrado.personaExistia ? "Se agregó el perfil Docente a una persona ya registrada. " : ""}
          {registrado.cuentaCreada
            ? registrado.correoEnviado
              ? `Enviamos sus credenciales a ${registrado.email}.`
              : `No se envió el correo a ${registrado.email}: entrégale la contraseña temporal.`
            : "Ya tenía una cuenta, así que ingresa con su contraseña actual."}{" "}
          Ahora asígnale sus cursos.
        </Alerta>
      )}
      {general && <Alerta tipo="error" titulo={general} />}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <DatosPersonales
            datos={datos}
            errores={errores}
            especialidades={catalogos.especialidades}
            bloqueado={Boolean(registrado)}
            onCambiar={(cambios) => setDatos((d) => ({ ...d, ...cambios }))}
          />
          <CargaAcademica
            docentes={catalogos.docentes}
            docenteId={docenteId}
            onDocente={setDocenteId}
            anios={catalogos.anios}
            anio={anio}
            onAnio={setAnioElegido}
          />
        </div>
        <div className="flex flex-col gap-6">
          <AccesoSistema
            datos={datos}
            registrado={registrado}
            enviarCorreo={enviarCorreo}
            onEnviarCorreo={setEnviarCorreo}
          />
          {!registrado && <VistaPreviaCorreo datos={datos} />}
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-borde pt-5">
        {registrado ? (
          <Boton onClick={() => router.push("/admin/usuarios")} icono="check-blanco">
            Terminar
          </Boton>
        ) : (
          <>
            <Boton variante="secundario" onClick={() => router.push("/admin/usuarios")} disabled={enviando}>
              Cancelar
            </Boton>
            <Boton onClick={registrar} cargando={enviando} icono="check-blanco">
              Registrar docente
            </Boton>
          </>
        )}
      </div>
    </>
  );
}
