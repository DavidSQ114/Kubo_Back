// AD-08 · Registrar apoderado y vincular sus estudiantes (US15, RF12, defecto D-07)
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Buscador,
  dniValido,
  errorFechaNacimiento,
  errorNombre,
  erroresParentesco,
  FilaVinculo,
  MENSAJE_APODERADO_EXISTENTE,
  MENSAJE_TELEFONO,
  type ApoderadoListado,
  type EstudianteListado,
  type VinculoEnPantalla,
} from "@/components/admin/apoderados";
import type { PersonaEncontrada } from "@/components/admin/docentes";
import { separarErrores } from "@/components/admin/grados";
import { alertaError } from "@/components/admin/PortalAdmin";
import { Alerta, Badge, Boton, Campo, Casilla, Icono, Tarjeta } from "@/components/ui";
import { api, ApiError, NOMBRE_ROL } from "@/lib/api";

interface DatosApoderado {
  dni: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  email: string;
  telefono: string;
  direccion: string;
  ocupacion: string;
}

const VACIO: DatosApoderado = {
  dni: "",
  nombres: "",
  apellidos: "",
  fechaNacimiento: "",
  email: "",
  telefono: "",
  direccion: "",
  ocupacion: "",
};

interface ApoderadoRegistrado {
  apoderadoId: string;
  nombreCompleto: string;
  email: string;
  personaExistia: boolean;
  cuentaCreada: boolean;
  correoEnviado: boolean;
  estudiantesVinculados: number;
  passwordTemporal: string | null;
}

/** Resultado de «Validar DNI»: persona registrada (o null) y, si ya es apoderado, su registro. */
interface Validacion {
  dni: string;
  persona: PersonaEncontrada | null;
  apoderado: Pick<ApoderadoListado, "apoderadoId" | "nombreCompleto" | "estudiantes"> | null;
}

interface EstudianteElegido {
  estudiante: EstudianteListado;
  vinculo: VinculoEnPantalla;
  /** Ya se vinculó (modo «Vincular a un estudiante»): no se vuelve a enviar. */
  vinculado?: boolean;
}

const CAMPO_POR_CODIGO: Record<string, string> = {
  PERSONA_NO_COINCIDE: "dni",
  DNI_EN_USO: "dni",
  EMAIL_EN_USO: "email",
};

function validar(d: DatosApoderado): Record<string, string> {
  const e: Record<string, string> = {};
  if (!dniValido(d.dni)) e.dni = "El DNI debe tener 8 dígitos";
  const nombres = errorNombre(d.nombres, "los nombres");
  if (nombres) e.nombres = nombres;
  const apellidos = errorNombre(d.apellidos, "los apellidos");
  if (apellidos) e.apellidos = apellidos;
  const fecha = errorFechaNacimiento(d.fechaNacimiento, true);
  if (fecha) e.fechaNacimiento = fecha;
  if (!d.email.trim()) e.email = "Ingresa el correo";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) e.email = "Formato de correo electrónico inválido";
  if (!/^\d{9}$/.test(d.telefono.replace(/[\s-]/g, ""))) e.telefono = MENSAJE_TELEFONO;
  if (d.direccion.trim().length < 5) e.direccion = "Ingresa la dirección";
  if (d.ocupacion.trim().length < 2) e.ocupacion = "Ingresa la ocupación";
  return e;
}

/** «Principal actual: Jorge Quispe» para ayudar a decidir si el nuevo apoderado será el principal. */
function ayudaPrincipal(e: EstudianteListado, v: VinculoEnPantalla) {
  const actual = e.apoderados.find((a) => a.esPrincipal);
  if (!actual) return "Será su apoderado principal: el estudiante aún no tiene uno.";
  return v.esPrincipal
    ? `Reemplazará a ${actual.nombreCompleto} como apoderado principal.`
    : `Principal actual: ${actual.nombreCompleto}.`;
}

export default function RegistrarApoderadoPage() {
  const router = useRouter();
  const [datos, setDatos] = useState<DatosApoderado>(VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [validacion, setValidacion] = useState<Validacion | null>(null);
  const [validando, setValidando] = useState(false);
  const [estudiantes, setEstudiantes] = useState<EstudianteElegido[]>([]);
  const [erroresVinculo, setErroresVinculo] = useState<Record<number, string>>({});
  const [enviarCorreo, setEnviarCorreo] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [registrado, setRegistrado] = useState<ApoderadoRegistrado | null>(null);
  const [vinculadosAhora, setVinculadosAhora] = useState<number | null>(null);

  const vigente = validacion && validacion.dni === datos.dni.trim() ? validacion : null;
  const yaApoderado = vigente?.apoderado ?? null;
  const agregaPerfil = Boolean(vigente?.persona) && !yaApoderado;
  const bloqueados: (keyof DatosApoderado)[] = vigente?.persona ? ["nombres", "apellidos"] : [];
  const terminado = Boolean(registrado) || vinculadosAhora !== null;
  const pendientes = estudiantes.filter((e) => !e.vinculado);

  function cambiar(cambios: Partial<DatosApoderado>) {
    setDatos((d) => {
      const nuevo = { ...d, ...cambios };
      // al cambiar el DNI se liberan los nombres que venían de la persona registrada
      if (cambios.dni !== undefined && vigente?.persona && cambios.dni.trim() !== vigente.dni) {
        return { ...nuevo, nombres: "", apellidos: "" };
      }
      return nuevo;
    });
  }

  async function validarDni() {
    const dni = datos.dni.trim();
    if (!dniValido(dni)) {
      setErrores((e) => ({ ...e, dni: "El DNI debe tener 8 dígitos" }));
      return;
    }
    setValidando(true);
    setGeneral(null);
    try {
      const persona = await api<PersonaEncontrada | null>(`/comunidad/personas?dni=${dni}`);
      let apoderado: Validacion["apoderado"] = null;
      if (persona?.perfiles.includes("APODERADO")) {
        const r = await api<{ items: ApoderadoListado[] }>(`/comunidad/apoderados?q=${dni}&tamano=1`);
        apoderado = r.items.find((a) => a.personaId === persona.personaId) ?? null;
      }
      setValidacion({ dni, persona, apoderado });
      setErrores((e) => ({ ...e, dni: "" }));
      // se usan los datos registrados: el backend solo agrega el perfil y completa lo que falte
      if (persona) {
        setDatos((d) => ({
          ...d,
          nombres: persona.nombres,
          apellidos: persona.apellidos,
          email: d.email || persona.email || "",
        }));
      }
    } catch (e) {
      setGeneral(alertaError(e));
    } finally {
      setValidando(false);
    }
  }

  function agregarEstudiante(estudiante: EstudianteListado) {
    setEstudiantes((lista) => [
      ...lista,
      // sin principal todavía, el apoderado lo será (el backend hace lo mismo)
      { estudiante, vinculo: { parentesco: "", esPrincipal: !estudiante.apoderados.length, autorizado: true } },
    ]);
  }

  function cambiarVinculo(indice: number, cambios: Partial<VinculoEnPantalla>) {
    setEstudiantes((lista) =>
      lista.map((e, i) => (i === indice ? { ...e, vinculo: { ...e.vinculo, ...cambios } } : e)),
    );
    setErroresVinculo((e) => ({ ...e, [indice]: "" }));
  }

  const cuerpoVinculo = (e: EstudianteElegido) => ({
    estudianteId: e.estudiante.estudianteId,
    parentesco: e.vinculo.parentesco,
    esPrincipal: e.vinculo.esPrincipal,
    autorizado: e.vinculo.autorizado,
  });

  async function guardar() {
    setGeneral(null);
    const ev = erroresParentesco(estudiantes.map((e) => e.vinculo));
    const e = yaApoderado ? {} : validar(datos);
    setErrores(e);
    setErroresVinculo(ev);
    if (Object.keys(e).length || Object.keys(ev).length) return;
    setEnviando(true);
    try {
      if (yaApoderado) await vincularPendientes(yaApoderado.apoderadoId);
      else await registrar();
    } finally {
      setEnviando(false);
    }
  }

  async function registrar() {
    try {
      const r = await api<ApoderadoRegistrado>("/comunidad/apoderados", {
        method: "POST",
        body: { ...datos, vinculos: estudiantes.map(cuerpoVinculo), enviarCorreo },
      });
      setRegistrado(r);
      setEstudiantes((lista) => lista.map((x) => ({ ...x, vinculado: true })));
    } catch (err) {
      if (err instanceof ApiError && err.codigo === "APODERADO_EXISTENTE") {
        // se pasa a «Vincular a un estudiante» en lugar de crear un duplicado
        const d = err.detalles as Validacion["apoderado"];
        setValidacion({ dni: datos.dni.trim(), persona: validacion?.persona ?? null, apoderado: d });
        return;
      }
      const r = separarErrores(err, CAMPO_POR_CODIGO);
      setErrores(r.campos);
      setGeneral(r.general);
    }
  }

  async function vincularPendientes(apoderadoId: string) {
    if (!pendientes.length) {
      setGeneral("Busca y agrega al menos un estudiante para vincularlo.");
      return;
    }
    let hechos = 0;
    for (const [i, e] of estudiantes.entries()) {
      if (e.vinculado) continue;
      try {
        await api("/comunidad/vinculos", { method: "POST", body: { ...cuerpoVinculo(e), apoderadoId } });
        hechos++;
        setEstudiantes((lista) => lista.map((x, j) => (j === i ? { ...x, vinculado: true } : x)));
      } catch (err) {
        setErroresVinculo((ev) => ({ ...ev, [i]: alertaError(err) }));
        return;
      }
    }
    setVinculadosAhora(hechos);
  }

  const campo = (clave: keyof DatosApoderado) => ({
    value: datos[clave],
    disabled: terminado || bloqueados.includes(clave) || (Boolean(yaApoderado) && clave !== "dni"),
    error: errores[clave] || undefined,
    onChange: (e: { target: { value: string } }) => cambiar({ [clave]: e.target.value }),
  });
  const nombreResumen =
    yaApoderado?.nombreCompleto ?? (`${datos.nombres} ${datos.apellidos}`.trim() || "Nuevo apoderado");

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Link
          href="/admin/usuarios"
          className="flex w-fit items-center gap-2 text-[14px] font-semibold text-kubo-azul hover:underline"
        >
          <Icono nombre="icon-back" size={16} /> Volver a Usuarios
        </Link>
        <h1 className="mt-3 text-[32px] font-bold leading-[1.2] text-texto">Registrar apoderado y sus estudiantes</h1>
        <p className="text-[16px] leading-[1.5] text-texto-2">
          Registra al padre, madre o tutor legal y vincúlalo con los estudiantes a su cargo. Cada estudiante necesita al
          menos un apoderado.
        </p>
      </div>

      {registrado && (
        <Alerta tipo="exito" icono="icon-check-verde" titulo={`${registrado.nombreCompleto} ya es apoderado`}>
          {registrado.personaExistia ? "Se agregó el perfil Apoderado a una persona ya registrada. " : ""}
          {registrado.cuentaCreada
            ? registrado.correoEnviado
              ? `Enviamos sus credenciales a ${registrado.email}. `
              : `No se envió el correo a ${registrado.email}: entrégale la contraseña temporal. `
            : "Ya tenía una cuenta, así que ingresa con su contraseña actual. "}
          {registrado.estudiantesVinculados
            ? `Quedó vinculado a ${registrado.estudiantesVinculados} estudiante(s).`
            : "Ahora puedes registrar a sus hijos y elegirlo como apoderado."}
        </Alerta>
      )}
      {vinculadosAhora !== null && yaApoderado && (
        <Alerta tipo="exito" icono="icon-check-verde" titulo="Vínculos guardados">
          {`${yaApoderado.nombreCompleto} quedó vinculado a ${vinculadosAhora} estudiante(s) más.`}
        </Alerta>
      )}
      {general && <Alerta tipo="error" titulo={general} />}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Tarjeta className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">Paso 1 · Datos del apoderado</h2>
              <p className="text-[14px] leading-[1.4] text-texto-3">Los campos con * son obligatorios</p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <Campo
                etiqueta="DNI"
                obligatorio
                icono="icon-search"
                inputMode="numeric"
                maxLength={8}
                placeholder="40125578"
                className="max-w-[280px]"
                {...campo("dni")}
              />
              <Boton
                variante="secundario"
                onClick={validarDni}
                cargando={validando}
                disabled={terminado}
                className={errores.dni ? "mb-[26px]" : ""}
              >
                Validar DNI
              </Boton>
            </div>
            {agregaPerfil && (
              <Alerta
                tipo="info"
                titulo={`Esta persona ya está registrada como ${vigente!.persona!.perfiles.map((r) => NOMBRE_ROL[r]).join(", ") || "persona sin perfiles activos"}`}
              >
                {`${vigente!.persona!.nombreCompleto}: se le agregará el perfil de Apoderado sin duplicar sus datos personales. Sus nombres se precargaron desde el registro existente y solo se completarán los datos que le falten.`}
              </Alerta>
            )}
            {yaApoderado && !terminado && (
              <Alerta tipo="aviso" icono="alerta-warn" titulo={MENSAJE_APODERADO_EXISTENTE}>
                {`${yaApoderado.nombreCompleto} · ${yaApoderado.estudiantes} estudiante(s) vinculado(s). Para evitar duplicados, vincúlale los estudiantes en el paso 2.`}
              </Alerta>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Campo etiqueta="Nombres" obligatorio maxLength={100} placeholder="Carmen Julia" {...campo("nombres")} />
              <Campo
                etiqueta="Apellidos"
                obligatorio
                maxLength={100}
                placeholder="Rojas Medina"
                {...campo("apellidos")}
              />
              <Campo
                etiqueta="Fecha de nacimiento"
                obligatorio
                type="date"
                icono="icon-calendar-gris"
                {...campo("fechaNacimiento")}
              />
              <Campo etiqueta="Ocupación" obligatorio maxLength={100} placeholder="Contadora" {...campo("ocupacion")} />
              <Campo
                etiqueta="Correo electrónico"
                obligatorio
                type="email"
                icono="icon-mail"
                maxLength={254}
                placeholder="carmen.rojas@correo.pe"
                {...campo("email")}
              />
              <Campo
                etiqueta="Teléfono celular"
                obligatorio
                inputMode="tel"
                maxLength={11}
                placeholder="987 654 321"
                {...campo("telefono")}
              />
            </div>
            <Campo
              etiqueta="Dirección"
              obligatorio
              maxLength={200}
              placeholder="Av. Universitaria 1801, San Miguel, Lima"
              {...campo("direccion")}
            />
          </Tarjeta>

          <Tarjeta className="flex flex-col gap-5 p-6">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex min-w-[200px] flex-1 flex-col gap-0.5">
                <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">Paso 2 · Estudiantes a cargo</h2>
                <p className="text-[14px] leading-[1.4] text-texto-3">
                  Vincula estudiantes ya registrados e indica el parentesco de cada uno
                </p>
              </div>
              <Badge tono="celeste" punto>
                {`${estudiantes.length} estudiante${estudiantes.length === 1 ? "" : "s"}`}
              </Badge>
            </div>
            {!terminado && (
              <Buscador<EstudianteListado>
                ruta="/comunidad/estudiantes"
                etiqueta="Buscar estudiante ya registrado"
                placeholder="DNI o nombre del estudiante"
                idDe={(e) => e.estudianteId}
                elegidos={estudiantes.map((e) => e.estudiante.estudianteId)}
                onElegir={agregarEstudiante}
                vacio="No hay estudiantes con ese DNI o nombre. Regístralo en «Registrar estudiante»."
                fila={(e) => (
                  <div className="flex flex-col">
                    <span className="text-[14px] font-semibold text-texto">{e.nombreCompleto}</span>
                    <span className="text-[12px] text-texto-3">
                      {`DNI ${e.dni}${e.gradoIngreso ? ` · ${e.gradoIngreso}` : ""}`}
                      {e.apoderados.length ? ` · ${e.apoderados.length} apoderado(s)` : ""}
                    </span>
                  </div>
                )}
              />
            )}
            {estudiantes.length > 0 ? (
              <div className="flex flex-col gap-3">
                <p className="text-[14px] font-medium text-texto-2">Estudiantes agregados</p>
                {estudiantes.map((e, i) => (
                  <FilaVinculo
                    key={e.estudiante.estudianteId}
                    nombre={e.estudiante.nombreCompleto}
                    detalle={`DNI ${e.estudiante.dni}${e.estudiante.gradoIngreso ? ` · ${e.estudiante.gradoIngreso}` : ""}${e.vinculado ? " · Vinculado" : ""}`}
                    vinculo={e.vinculo}
                    error={erroresVinculo[i] || undefined}
                    ayudaPrincipal={e.vinculado ? undefined : ayudaPrincipal(e.estudiante, e.vinculo)}
                    deshabilitado={e.vinculado || terminado}
                    onCambiar={(c) => cambiarVinculo(i, c)}
                    onQuitar={() => {
                      setEstudiantes((lista) => lista.filter((_, j) => j !== i));
                      setErroresVinculo({});
                    }}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-fondo px-4 py-3 text-[14px] text-texto-2">
                Aún no hay estudiantes vinculados. Si su hijo todavía no está registrado, guarda al apoderado y luego
                regístralo en «Registrar estudiante», donde podrás elegirlo como apoderado.
              </p>
            )}
            <Alerta tipo="info" titulo="El parentesco y el apoderado principal son de cada vínculo">
              Cada estudiante tiene exactamente un apoderado principal. Si marcas a este apoderado como principal,
              reemplaza al anterior.
            </Alerta>
          </Tarjeta>
        </div>

        <div className="flex flex-col gap-6">
          <Tarjeta className="flex flex-col gap-4 p-6">
            <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">Resumen</h2>
            <dl className="flex flex-col gap-2 text-[14px]">
              <div className="flex justify-between gap-3">
                <dt className="text-texto-3">Apoderado</dt>
                <dd className="text-right font-semibold text-texto">{nombreResumen}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-texto-3">Estudiantes</dt>
                <dd className="text-right text-texto">
                  {pendientes.length ? `${pendientes.length} por vincular` : `${estudiantes.length} vinculado(s)`}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-texto-3">Siguiente paso</dt>
                <dd className="text-right text-kubo-azul">Registrar estudiante</dd>
              </div>
            </dl>
            {terminado ? (
              <>
                <Boton
                  icono="icon-userplus-blanco"
                  onClick={() => router.push("/admin/usuarios/registrar-estudiante")}
                  ancho
                >
                  Registrar un estudiante
                </Boton>
                <Boton variante="secundario" onClick={() => router.push("/admin/usuarios")} ancho>
                  Terminar
                </Boton>
              </>
            ) : (
              <>
                <Boton onClick={guardar} cargando={enviando} icono="check-blanco" ancho>
                  {yaApoderado
                    ? "Vincular estudiantes"
                    : agregaPerfil
                      ? "Agregar perfil Apoderado"
                      : "Guardar apoderado"}
                </Boton>
                <Boton variante="secundario" onClick={() => router.push("/admin/usuarios")} disabled={enviando} ancho>
                  Cancelar
                </Boton>
              </>
            )}
            <p className="text-[12px] leading-[1.4] text-texto-3">
              Si el apoderado ya existe, valida su DNI: podrás vincularle otro hijo sin crear un duplicado.
            </p>
          </Tarjeta>

          <Tarjeta className="flex flex-col gap-4 p-6">
            <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">Acceso al portal</h2>
            <div className="flex flex-col gap-1">
              <p className="text-[13px] text-texto-3">Rol asignado</p>
              <span>
                <Badge tono="verde">Apoderado</Badge>
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-[13px] text-texto-3">Usuario</p>
              <p className="break-all text-[16px] font-semibold text-texto">
                {registrado?.email ?? (datos.email.trim() || "correo@ejemplo.pe")}
              </p>
            </div>
            {registrado?.passwordTemporal ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-[13px] text-texto-3">Contraseña temporal (solo se muestra esta vez)</p>
                <code className="rounded-lg border border-borde bg-fondo px-4 py-2 text-[18px] font-semibold tracking-[1px] text-texto">
                  {registrado.passwordTemporal}
                </code>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                <p className="text-[13px] text-texto-3">Contraseña</p>
                <p className="text-[14px] font-semibold text-texto">
                  {registrado || vigente?.persona?.tieneCuenta
                    ? "Ya tiene una cuenta: ingresa con su contraseña actual"
                    : "Temporal · se genera al guardar"}
                </p>
              </div>
            )}
            {!terminado && !yaApoderado && !vigente?.persona?.tieneCuenta && (
              <Casilla
                etiqueta="Enviar correo de bienvenida con credenciales"
                checked={enviarCorreo}
                onChange={setEnviarCorreo}
                color="verde"
              />
            )}
            <p className="text-[13px] leading-[1.4] text-texto-2">
              Con su cuenta podrá revisar pagos, asistencia, horario y libreta de notas de sus hijos. Deberá cambiar la
              contraseña en su primer ingreso.
            </p>
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
