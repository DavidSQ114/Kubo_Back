// AD-09 · Registrar estudiante y vincularlo con sus apoderados (US17, RF13, defecto D-07)
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Buscador,
  dniValido,
  errorFechaNacimiento,
  errorNombre,
  erroresParentesco,
  FilaVinculo,
  ItemValidacion,
  MENSAJE_ESTUDIANTE_EXISTENTE,
  MENSAJE_SIN_APODERADO,
  telefonoLegible,
  type ApoderadoListado,
  type VinculoEnPantalla,
} from "@/components/admin/apoderados";
import type { PersonaEncontrada } from "@/components/admin/docentes";
import { Selector, separarErrores, type Grado } from "@/components/admin/grados";
import { alertaError } from "@/components/admin/PortalAdmin";
import { Alerta, Boton, Campo, Icono, Spinner, Tarjeta } from "@/components/ui";
import { api, NOMBRE_ROL } from "@/lib/api";

interface DatosEstudiante {
  nombres: string;
  apellidos: string;
  dni: string;
  fechaNacimiento: string;
  sexo: "" | "FEMENINO" | "MASCULINO";
  gradoIngresoId: string;
  colegioProcedencia: string;
  direccion: string;
}

const VACIO: DatosEstudiante = {
  nombres: "",
  apellidos: "",
  dni: "",
  fechaNacimiento: "",
  sexo: "",
  gradoIngresoId: "",
  colegioProcedencia: "",
  direccion: "",
};

interface ApoderadoElegido {
  apoderado: ApoderadoListado;
  vinculo: VinculoEnPantalla;
}

interface EstudianteRegistrado {
  estudianteId: string;
  nombreCompleto: string;
  personaExistia: boolean;
  vinculos: number;
  matricula: { anio: number; estado: "EN_PROCESO" } | null;
}

const CAMPO_POR_CODIGO: Record<string, string> = {
  ESTUDIANTE_EXISTENTE: "dni",
  PERSONA_NO_COINCIDE: "dni",
  DNI_EN_USO: "dni",
  GRADO_INVALIDO: "gradoIngresoId",
  SIN_APODERADO: "apoderados",
  PRINCIPAL_INVALIDO: "apoderados",
  APODERADO_REPETIDO: "apoderados",
  APODERADO_NO_ENCONTRADO: "apoderados",
};

const PASOS = ["Datos y apoderado", "Matrícula en sección", "Cronograma de pagos"];

function validar(d: DatosEstudiante, apoderados: ApoderadoElegido[]): Record<string, string> {
  const e: Record<string, string> = {};
  const nombres = errorNombre(d.nombres, "los nombres");
  if (nombres) e.nombres = nombres;
  const apellidos = errorNombre(d.apellidos, "los apellidos");
  if (apellidos) e.apellidos = apellidos;
  if (!dniValido(d.dni)) e.dni = "El DNI debe tener 8 dígitos";
  const fecha = errorFechaNacimiento(d.fechaNacimiento, true);
  if (fecha) e.fechaNacimiento = fecha;
  if (!d.gradoIngresoId) e.gradoIngresoId = "Elige el grado de ingreso";
  if (!apoderados.length) e.apoderados = MENSAJE_SIN_APODERADO;
  else if (apoderados.filter((a) => a.vinculo.esPrincipal).length !== 1) {
    e.apoderados = "Marca exactamente un apoderado como principal.";
  }
  return e;
}

export default function RegistrarEstudiantePage() {
  const router = useRouter();
  const [grados, setGrados] = useState<Grado[] | null>(null);
  const [errorGrados, setErrorGrados] = useState<string | null>(null);
  const [datos, setDatos] = useState<DatosEstudiante>(VACIO);
  const [apoderados, setApoderados] = useState<ApoderadoElegido[]>([]);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [erroresVinculo, setErroresVinculo] = useState<Record<number, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<"normal" | "borrador" | null>(null);
  const [registrado, setRegistrado] = useState<EstudianteRegistrado | null>(null);
  // D-07: persona ya registrada con el DNI escrito; se consulta al completar los 8 dígitos
  const [consulta, setConsulta] = useState<{ dni: string; persona: PersonaEncontrada | null } | null>(null);
  const dniCompleto = dniValido(datos.dni) ? datos.dni.trim() : null;

  useEffect(() => {
    async function cargar() {
      try {
        setGrados(await api<Grado[]>("/academico/grados"));
      } catch (e) {
        setErrorGrados(alertaError(e));
      }
    }
    void cargar();
  }, []);

  useEffect(() => {
    if (!dniCompleto || registrado) return;
    let vigente = true;
    async function buscar() {
      try {
        const persona = await api<PersonaEncontrada | null>(`/comunidad/personas?dni=${dniCompleto}`);
        if (!vigente) return;
        setConsulta({ dni: dniCompleto!, persona });
        if (persona && !persona.perfiles.includes("ALUMNO")) {
          setDatos((d) => ({ ...d, nombres: persona.nombres, apellidos: persona.apellidos }));
        }
      } catch {
        if (vigente) setConsulta(null); // sin la consulta, el backend igual valida al guardar
      }
    }
    void buscar();
    return () => {
      vigente = false;
    };
  }, [dniCompleto, registrado]);

  const persona = consulta && consulta.dni === dniCompleto ? consulta.persona : null;
  const consultado = Boolean(consulta && consulta.dni === dniCompleto);
  const yaEsEstudiante = persona?.perfiles.includes("ALUMNO") ?? false;
  const agregaPerfil = Boolean(persona) && !yaEsEstudiante;
  const principal = apoderados.find((a) => a.vinculo.esPrincipal);
  const obligatoriosCompletos =
    !errorNombre(datos.nombres, "los nombres") &&
    !errorNombre(datos.apellidos, "los apellidos") &&
    Boolean(datos.fechaNacimiento && datos.gradoIngresoId);

  function cambiar(cambios: Partial<DatosEstudiante>) {
    setDatos((d) => {
      const nuevo = { ...d, ...cambios };
      if (cambios.dni !== undefined && agregaPerfil && cambios.dni.trim() !== dniCompleto) {
        return { ...nuevo, nombres: "", apellidos: "" };
      }
      return nuevo;
    });
  }

  function agregarApoderado(apoderado: ApoderadoListado) {
    // el primero queda como principal; luego se puede cambiar
    setApoderados((lista) => [
      ...lista,
      { apoderado, vinculo: { parentesco: "", esPrincipal: lista.length === 0, autorizado: true } },
    ]);
    setErrores((e) => ({ ...e, apoderados: "" }));
  }

  function cambiarVinculo(indice: number, cambios: Partial<VinculoEnPantalla>) {
    setApoderados((lista) =>
      lista.map((a, i) => {
        // marcar a uno como principal desmarca a los demás: siempre hay exactamente uno
        if (cambios.esPrincipal && i !== indice) return { ...a, vinculo: { ...a.vinculo, esPrincipal: false } };
        return i === indice ? { ...a, vinculo: { ...a.vinculo, ...cambios } } : a;
      }),
    );
    setErroresVinculo((e) => ({ ...e, [indice]: "" }));
  }

  function quitarApoderado(indice: number) {
    setApoderados((lista) => {
      const resto = lista.filter((_, i) => i !== indice);
      // si se quita al principal, el primero que queda pasa a serlo
      if (resto.length && !resto.some((a) => a.vinculo.esPrincipal)) {
        resto[0] = { ...resto[0], vinculo: { ...resto[0].vinculo, esPrincipal: true } };
      }
      return resto;
    });
    setErroresVinculo({});
  }

  function reiniciar() {
    setDatos(VACIO);
    setApoderados([]);
    setErrores({});
    setErroresVinculo({});
    setGeneral(null);
    setConsulta(null);
    setRegistrado(null);
  }

  async function guardar(borrador: boolean) {
    setGeneral(null);
    const e = validar(datos, apoderados);
    if (yaEsEstudiante) e.dni = MENSAJE_ESTUDIANTE_EXISTENTE;
    const ev = erroresParentesco(apoderados.map((a) => a.vinculo));
    setErrores(e);
    setErroresVinculo(ev);
    if (Object.keys(e).length || Object.keys(ev).length) return;
    setEnviando(borrador ? "borrador" : "normal");
    try {
      const r = await api<EstudianteRegistrado>("/comunidad/estudiantes", {
        method: "POST",
        body: {
          dni: datos.dni,
          nombres: datos.nombres,
          apellidos: datos.apellidos,
          fechaNacimiento: datos.fechaNacimiento,
          gradoIngresoId: datos.gradoIngresoId,
          sexo: datos.sexo || null,
          colegioProcedencia: datos.colegioProcedencia || null,
          direccion: datos.direccion || null,
          apoderados: apoderados.map((a) => ({ apoderadoId: a.apoderado.apoderadoId, ...a.vinculo })),
          borrador,
        },
      });
      setRegistrado(r);
    } catch (err) {
      const r = separarErrores(err, CAMPO_POR_CODIGO);
      setErrores(r.campos);
      setGeneral(r.general);
    } finally {
      setEnviando(null);
    }
  }

  if (errorGrados) {
    return (
      <Alerta tipo="error" titulo="No pudimos cargar el formulario">
        {errorGrados}
      </Alerta>
    );
  }
  if (!grados) {
    return (
      <Tarjeta className="flex items-center justify-center gap-3 p-12 text-[14px] text-texto-2">
        <Spinner claro={false} /> Cargando…
      </Tarjeta>
    );
  }

  const bloqueado = Boolean(registrado);
  const campo = (clave: Exclude<keyof DatosEstudiante, "sexo">) => ({
    value: datos[clave],
    disabled: bloqueado || (agregaPerfil && (clave === "nombres" || clave === "apellidos")),
    error: errores[clave] || undefined,
    onChange: (e: { target: { value: string } }) => cambiar({ [clave]: e.target.value }),
  });
  const errorDni = yaEsEstudiante && !registrado ? MENSAJE_ESTUDIANTE_EXISTENTE : errores.dni || undefined;

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Link
          href="/admin/usuarios"
          className="flex w-fit items-center gap-2 text-[14px] font-semibold text-kubo-azul hover:underline"
        >
          <Icono nombre="icon-back" size={16} /> Volver a Usuarios
        </Link>
        <h1 className="mt-3 text-[32px] font-bold leading-[1.2] text-texto">Registrar estudiante</h1>
        <p className="text-[16px] leading-[1.5] text-texto-2">
          Registra los datos personales del estudiante y vincúlalo con al menos un apoderado ya registrado.
        </p>
      </div>

      <Tarjeta className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
        {PASOS.map((paso, i) => (
          <div key={paso} className="flex flex-1 items-center gap-3">
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                i === 0 ? "bg-kubo-azul text-white" : "border border-borde text-texto-3"
              }`}
            >
              {i + 1}
            </span>
            <span className={`text-[14px] ${i === 0 ? "font-semibold text-texto" : "text-texto-3"}`}>{paso}</span>
            {i < PASOS.length - 1 && <span aria-hidden className="hidden h-px flex-1 bg-borde md:block" />}
          </div>
        ))}
      </Tarjeta>

      {registrado && (
        <Alerta tipo="exito" icono="icon-check-verde" titulo={`Se registró a ${registrado.nombreCompleto}`}>
          {registrado.personaExistia ? "Se agregó el perfil Estudiante a una persona ya registrada. " : ""}
          {`Quedó vinculado a ${registrado.vinculos} apoderado(s). `}
          {registrado.matricula
            ? `Su matrícula ${registrado.matricula.anio} quedó «En proceso», sin sección ni cronograma de pagos.`
            : "Podrás matricularlo en una sección con vacantes."}
        </Alerta>
      )}
      {general && <Alerta tipo="error" titulo={general} />}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Tarjeta className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">Datos del estudiante</h2>
              <p className="text-[14px] leading-[1.4] text-texto-3">Los campos con * son obligatorios</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Campo etiqueta="Nombres" obligatorio maxLength={100} placeholder="Valeria Sofía" {...campo("nombres")} />
              <Campo
                etiqueta="Apellidos"
                obligatorio
                maxLength={100}
                placeholder="Quispe Rojas"
                {...campo("apellidos")}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Campo
                  etiqueta="DNI"
                  obligatorio
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="78451236"
                  {...campo("dni")}
                  error={errorDni}
                />
                {!errorDni && (
                  <p className="text-[13px] leading-[1.4] text-texto-3">
                    8 dígitos. No puede repetirse entre estudiantes.
                  </p>
                )}
              </div>
              <Campo
                etiqueta="Fecha de nacimiento"
                obligatorio
                type="date"
                icono="icon-calendar-gris"
                {...campo("fechaNacimiento")}
              />
              <Selector
                etiqueta="Sexo (opcional)"
                valor={datos.sexo}
                deshabilitado={bloqueado}
                onCambiar={(sexo) => cambiar({ sexo: sexo as DatosEstudiante["sexo"] })}
              >
                <option value="">Sin indicar</option>
                <option value="FEMENINO">Femenino</option>
                <option value="MASCULINO">Masculino</option>
              </Selector>
            </div>
            {agregaPerfil && !registrado && (
              <Alerta
                tipo="info"
                titulo={`Este DNI ya está registrado: ${persona!.nombreCompleto} (${persona!.perfiles.map((r) => NOMBRE_ROL[r]).join(", ") || "sin perfiles activos"})`}
              >
                Se le agregará el perfil Estudiante con sus datos personales actuales.
              </Alerta>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Selector
                etiqueta="Grado de ingreso"
                obligatorio
                valor={datos.gradoIngresoId}
                deshabilitado={bloqueado}
                error={errores.gradoIngresoId || undefined}
                onCambiar={(gradoIngresoId) => cambiar({ gradoIngresoId })}
              >
                <option value="">Elige el grado</option>
                {grados.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombre}
                  </option>
                ))}
              </Selector>
              <Campo
                etiqueta="Colegio de procedencia (opcional)"
                maxLength={150}
                placeholder="I.E. San Martín de Porres"
                {...campo("colegioProcedencia")}
              />
            </div>
            <Campo
              etiqueta="Dirección (opcional)"
              maxLength={200}
              placeholder="Av. Universitaria 1801, San Miguel, Lima"
              {...campo("direccion")}
            />
          </Tarjeta>

          <Tarjeta className="flex flex-col gap-5 p-6">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex min-w-[200px] flex-1 flex-col gap-0.5">
                <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">Apoderados vinculados</h2>
                <p className="text-[14px] leading-[1.4] text-texto-3">Obligatorio: al menos un apoderado</p>
              </div>
              {!bloqueado && (
                <Link
                  href="/admin/usuarios/registrar-apoderado"
                  className="flex items-center gap-2 text-[16px] font-bold text-kubo-azul hover:underline"
                >
                  <Icono nombre="icon-userplus" size={20} /> Registrar apoderado
                </Link>
              )}
            </div>
            {!bloqueado && (
              <Buscador<ApoderadoListado>
                ruta="/comunidad/apoderados"
                etiqueta="Buscar apoderado"
                placeholder="Buscar apoderado por DNI o nombre"
                idDe={(a) => a.apoderadoId}
                elegidos={apoderados.map((a) => a.apoderado.apoderadoId)}
                onElegir={agregarApoderado}
                vacio="No hay apoderados con ese DNI o nombre. Regístralo primero con «Registrar apoderado»."
                fila={(a) => (
                  <div className="flex flex-col">
                    <span className="text-[14px] font-semibold text-texto">{a.nombreCompleto}</span>
                    <span className="text-[12px] text-texto-3">
                      {`DNI ${a.dni}${a.telefono ? ` · ${telefonoLegible(a.telefono)}` : ""} · ${a.estudiantes} estudiante(s)`}
                    </span>
                  </div>
                )}
              />
            )}
            {apoderados.map((a, i) => (
              <FilaVinculo
                key={a.apoderado.apoderadoId}
                nombre={a.apoderado.nombreCompleto}
                detalle={`DNI ${a.apoderado.dni}${a.vinculo.parentesco ? ` · ${a.vinculo.parentesco}` : ""}${a.apoderado.telefono ? ` · ${telefonoLegible(a.apoderado.telefono)}` : ""}`}
                vinculo={a.vinculo}
                error={erroresVinculo[i] || undefined}
                principalBloqueado={apoderados.length === 1}
                deshabilitado={bloqueado}
                onCambiar={(c) => cambiarVinculo(i, c)}
                onQuitar={() => quitarApoderado(i)}
              />
            ))}
            {errores.apoderados && (
              <Alerta tipo="error" titulo={errores.apoderados}>
                {errores.apoderados === MENSAJE_SIN_APODERADO
                  ? "Busca al apoderado por DNI o nombre y vincúlalo, o regístralo primero."
                  : undefined}
              </Alerta>
            )}
          </Tarjeta>
        </div>

        <div className="flex flex-col gap-6">
          <Tarjeta className="flex flex-col gap-4 p-6">
            <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">Validaciones</h2>
            <ul className="flex flex-col gap-3">
              <ItemValidacion ok={dniCompleto ? true : datos.dni ? false : null} titulo="DNI con 8 dígitos" />
              <ItemValidacion
                ok={dniCompleto && consultado ? !yaEsEstudiante : null}
                titulo="DNI no registrado"
                detalle={yaEsEstudiante ? MENSAJE_ESTUDIANTE_EXISTENTE : undefined}
              />
              <ItemValidacion
                ok={principal ? true : errores.apoderados ? false : null}
                titulo="Apoderado vinculado"
                detalle={principal ? `${principal.apoderado.nombreCompleto} (principal)` : undefined}
              />
              <ItemValidacion ok={obligatoriosCompletos ? true : null} titulo="Datos obligatorios completos" />
            </ul>
          </Tarjeta>

          <Tarjeta className="flex flex-col gap-3 p-6">
            {registrado ? (
              <>
                <Boton icono="icon-userplus-blanco" onClick={reiniciar} ancho>
                  Registrar otro estudiante
                </Boton>
                <Boton variante="secundario" onClick={() => router.push("/admin/usuarios")} ancho>
                  Volver a Usuarios
                </Boton>
              </>
            ) : (
              <>
                <p className="text-[14px] leading-[1.4] text-texto-2">
                  Al guardar, el estudiante quedará registrado y podrás matricularlo en una sección con vacantes.
                </p>
                <Boton
                  onClick={() => guardar(false)}
                  cargando={enviando === "normal"}
                  disabled={enviando !== null}
                  icono="check-blanco"
                  ancho
                >
                  Guardar
                </Boton>
                <Boton
                  variante="secundario"
                  onClick={() => guardar(true)}
                  cargando={enviando === "borrador"}
                  disabled={enviando !== null}
                  ancho
                >
                  Guardar como borrador
                </Boton>
                <p className="text-[12px] leading-[1.4] text-texto-3">
                  El borrador deja su matrícula «En proceso» en el año en matrícula, sin sección, sin validar vacantes
                  ni generar el cronograma de pagos.
                </p>
              </>
            )}
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
