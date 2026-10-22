// Piezas de AD-07 Registrar docente y asignar cursos (US13, US14): datos personales, acceso al sistema,
// vista previa del correo de bienvenida y carga académica (cursos y secciones del docente).
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Alerta, Badge, Boton, Campo, Casilla, Icono, Spinner, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";
import type { AnioAcademico } from "./anio";
import type { Curso } from "./cursos";
import { nombreSeccion, Selector, separarErrores, type Docente, type Seccion } from "./grados";
import { alertaError } from "./PortalAdmin";

export interface DatosDocente {
  nombres: string;
  apellidos: string;
  dni: string;
  fechaNacimiento: string;
  email: string;
  telefono: string;
  especialidad: string;
}

export const DOCENTE_VACIO: DatosDocente = {
  nombres: "",
  apellidos: "",
  dni: "",
  fechaNacimiento: "",
  email: "",
  telefono: "",
  especialidad: "",
};

export interface DocenteRegistrado {
  personaId: string;
  docenteId: string;
  nombreCompleto: string;
  email: string;
  especialidad: string;
  personaExistia: boolean;
  cuentaCreada: boolean;
  correoEnviado: boolean;
  passwordTemporal: string | null;
}

interface Asignacion {
  id: string;
  curso: { id: string; codigo: string; nombre: string };
  grado: { numero: number };
  seccion: { id: string; nombre: string };
  horasSemanales: number;
  horarioPublicado: boolean;
}

const CAMPO_POR_CODIGO: Record<string, string> = { DOCENTE_EXISTENTE: "dni", EMAIL_EN_USO: "email" };

/** Datos del formulario → cuerpo de POST /comunidad/docentes (los opcionales vacíos no se envían). */
export const cuerpoDocente = (d: DatosDocente, enviarCorreo: boolean) => ({
  dni: d.dni,
  nombres: d.nombres,
  apellidos: d.apellidos,
  email: d.email,
  especialidad: d.especialidad,
  telefono: d.telefono.trim() || null,
  fechaNacimiento: d.fechaNacimiento || null,
  enviarCorreo,
});

/** Validación en el navegador con los mismos mensajes del backend (que igual valida todo). */
export function validarDocente(d: DatosDocente): Record<string, string> {
  const e: Record<string, string> = {};
  if (d.nombres.trim().length < 2) e.nombres = "Ingresa los nombres";
  if (d.apellidos.trim().length < 2) e.apellidos = "Ingresa los apellidos";
  if (!/^\d{8}$/.test(d.dni.trim())) e.dni = "El DNI debe tener 8 dígitos";
  if (!d.email.trim()) e.email = "Ingresa el correo";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) e.email = "Formato de correo electrónico inválido";
  if (d.telefono.trim() && !/^\d{9}$/.test(d.telefono.replace(/[\s-]/g, ""))) {
    e.telefono = "El teléfono debe tener 9 dígitos";
  }
  if (!d.especialidad) e.especialidad = "Elige la especialidad";
  return e;
}

export function erroresDeRegistro(err: unknown) {
  return separarErrores(err, CAMPO_POR_CODIGO);
}

function TituloPaso({
  numero,
  titulo,
  subtitulo,
  derecha,
}: {
  numero: number;
  titulo: string;
  subtitulo: string;
  derecha?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-kubo-azul text-[13px] font-bold text-white">
        {numero}
      </span>
      <div className="flex min-w-[200px] flex-1 flex-col gap-0.5">
        <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">{titulo}</h2>
        <p className="text-[14px] leading-[1.4] text-texto-3">{subtitulo}</p>
      </div>
      {derecha}
    </div>
  );
}

// ---------- 1 · Datos personales ----------

export function DatosPersonales({
  datos,
  errores,
  especialidades,
  bloqueado,
  onCambiar,
}: {
  datos: DatosDocente;
  errores: Record<string, string>;
  especialidades: string[];
  bloqueado: boolean;
  onCambiar: (cambios: Partial<DatosDocente>) => void;
}) {
  const campo = (clave: keyof DatosDocente) => ({
    value: datos[clave],
    disabled: bloqueado,
    error: errores[clave],
    onChange: (e: { target: { value: string } }) => onCambiar({ [clave]: e.target.value }),
  });
  return (
    <Tarjeta className="flex flex-col gap-5 p-6">
      <TituloPaso numero={1} titulo="Datos personales" subtitulo="Los campos con * son obligatorios" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Campo etiqueta="Nombres" obligatorio maxLength={100} placeholder="Juan Carlos" {...campo("nombres")} />
        <Campo etiqueta="Apellidos" obligatorio maxLength={100} placeholder="Pérez Salazar" {...campo("apellidos")} />
        <Campo etiqueta="DNI" obligatorio inputMode="numeric" maxLength={8} placeholder="45872136" {...campo("dni")} />
        <Campo etiqueta="Fecha de nacimiento" type="date" icono="icon-calendar-gris" {...campo("fechaNacimiento")} />
        <div className="flex flex-col gap-1.5">
          <Campo
            etiqueta="Correo institucional"
            obligatorio
            type="email"
            icono="icon-mail"
            maxLength={254}
            placeholder="juan.perez@kubo.edu.pe"
            {...campo("email")}
          />
          {!errores.email && (
            <p className="text-[13px] leading-[1.4] text-texto-3">Aquí se enviarán las credenciales de acceso.</p>
          )}
        </div>
        <Campo
          etiqueta="Teléfono celular"
          inputMode="tel"
          maxLength={11}
          placeholder="987 654 321"
          {...campo("telefono")}
        />
      </div>
      <Selector
        etiqueta="Especialidad"
        obligatorio
        valor={datos.especialidad}
        deshabilitado={bloqueado}
        error={errores.especialidad}
        onCambiar={(especialidad) => onCambiar({ especialidad })}
      >
        <option value="">Elige la especialidad</option>
        {especialidades.map((e) => (
          <option key={e} value={e}>
            {e}
          </option>
        ))}
      </Selector>
    </Tarjeta>
  );
}

// ---------- Acceso al sistema y vista previa del correo ----------

const iniciales = (nombres: string, apellidos: string) =>
  `${nombres.trim().charAt(0)}${apellidos.trim().charAt(0)}`.toUpperCase() || "—";

export function AccesoSistema({
  datos,
  registrado,
  enviarCorreo,
  onEnviarCorreo,
}: {
  datos: DatosDocente;
  registrado: DocenteRegistrado | null;
  enviarCorreo: boolean;
  onEnviarCorreo: (v: boolean) => void;
}) {
  const nombre = registrado?.nombreCompleto ?? (`${datos.nombres} ${datos.apellidos}`.trim() || "Nuevo docente");
  const email = registrado?.email ?? (datos.email || "correo@kubo.edu.pe");
  return (
    <Tarjeta className="flex flex-col gap-4 p-6">
      <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">Acceso al sistema</h2>
      <div className="flex items-center gap-3 rounded-lg bg-fondo p-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-kubo-azul text-[14px] font-bold text-white">
          {iniciales(datos.nombres || nombre, datos.apellidos || nombre.split(" ").slice(-1)[0])}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[14px] font-semibold leading-[1.4] text-texto">{nombre}</span>
          <span className="truncate text-[12px] text-texto-3">{email}</span>
        </div>
        <Badge tono="azul">Docente</Badge>
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
          <p className="text-[16px] font-semibold text-texto">
            {registrado ? "Ya tenía una cuenta: usa su contraseña actual" : "Temporal · se genera al guardar"}
          </p>
        </div>
      )}
      {!registrado && (
        <Casilla
          etiqueta="Enviar correo de bienvenida con credenciales"
          checked={enviarCorreo}
          onChange={onEnviarCorreo}
          color="verde"
        />
      )}
      <p className="flex gap-2 text-[14px] leading-[1.4] text-texto-2">
        <Icono nombre="icon-lock" size={16} />
        El sistema exigirá cambiar la contraseña en el primer ingreso
      </p>
      <Alerta tipo="info">El docente verá sus cursos y secciones en su panel al iniciar sesión.</Alerta>
    </Tarjeta>
  );
}

/** Mismo texto que envía identidad (enviarBienvenida), con la contraseña oculta. */
export function VistaPreviaCorreo({ datos }: { datos: DatosDocente }) {
  const email = datos.email.trim() || "correo@kubo.edu.pe";
  return (
    <Tarjeta className="flex flex-col gap-4 p-6">
      <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">Vista previa del correo</h2>
      <div className="flex flex-col gap-2 rounded-lg border border-borde p-4 text-[13px] leading-[1.5] text-texto-2">
        <p className="font-semibold text-texto">Asunto: Kubo · Tu cuenta fue creada</p>
        <p>
          Hola, {datos.nombres.trim() || "docente"}. Se creó tu cuenta en Kubo. Usuario: {email} · Contraseña temporal:
          ••••••••. En tu primer ingreso deberás cambiar la contraseña.
        </p>
      </div>
    </Tarjeta>
  );
}

// ---------- 2 · Carga académica ----------

export function CargaAcademica({
  docentes,
  docenteId,
  onDocente,
  anios,
  anio,
  onAnio,
}: {
  docentes: Docente[];
  docenteId: string;
  onDocente: (id: string) => void;
  anios: AnioAcademico[];
  anio: AnioAcademico | undefined;
  onAnio: (id: string) => void;
}) {
  const [datos, setDatos] = useState<{
    clave: string;
    secciones: Seccion[];
    cursos: Curso[];
    asignaciones: Asignacion[];
  } | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [seccionId, setSeccionId] = useState("");
  const [cursoId, setCursoId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [alerta, setAlerta] = useState<{ tipo: "error" | "exito"; texto: string } | null>(null);
  const clave = `${docenteId}-${anio?.id}-${recarga}`;

  useEffect(() => {
    if (!docenteId || !anio) return;
    let vigente = true;
    async function cargar() {
      try {
        const [secciones, cursos, asignaciones] = await Promise.all([
          api<Seccion[]>(`/academico/secciones?anioId=${anio!.id}`),
          api<Curso[]>(`/academico/cursos?anioId=${anio!.id}&estado=ACTIVO`),
          api<Asignacion[]>(`/academico/asignaciones?docenteId=${docenteId}&anioId=${anio!.id}`),
        ]);
        if (vigente) setDatos({ clave: `${docenteId}-${anio!.id}-${recarga}`, secciones, cursos, asignaciones });
      } catch (e) {
        if (vigente) setErrorCarga(alertaError(e));
      }
    }
    void cargar();
    return () => {
      vigente = false;
    };
  }, [docenteId, anio, recarga]);

  const listo = datos?.clave === clave ? datos : null;
  const seccion = listo?.secciones.find((s) => s.id === seccionId);
  // cursos del plan de estudios del grado de la sección elegida
  const cursosDelGrado = seccion
    ? (listo?.cursos ?? []).filter((c) => c.planes.some((p) => p.grado.id === seccion.grado.id))
    : [];
  const asignaciones = listo?.asignaciones ?? [];
  const horas = asignaciones.reduce((t, a) => t + a.horasSemanales, 0);

  async function asignar() {
    setAlerta(null);
    if (!seccionId || !cursoId) {
      setAlerta({ tipo: "error", texto: "Elige la sección y el curso." });
      return;
    }
    setEnviando(true);
    try {
      const a = await api<Asignacion>("/academico/asignaciones", {
        method: "POST",
        body: { docenteId, seccionId, cursoId },
      });
      setAlerta({ tipo: "exito", texto: `Se asignó ${a.curso.nombre} en ${a.grado.numero}° ${a.seccion.nombre}.` });
      setCursoId("");
      setRecarga((n) => n + 1);
    } catch (e) {
      setAlerta({ tipo: "error", texto: alertaError(e) });
    } finally {
      setEnviando(false);
    }
  }

  async function quitar(a: Asignacion) {
    setAlerta(null);
    try {
      const r = await api<{ resultado: "ELIMINADA" | "DESACTIVADA" }>(`/academico/asignaciones/${a.id}`, {
        method: "DELETE",
      });
      const como = r.resultado === "ELIMINADA" ? "Se quitó" : "Se desactivó (tiene notas u horarios)";
      setAlerta({ tipo: "exito", texto: `${como} ${a.curso.nombre} de ${a.grado.numero}° ${a.seccion.nombre}.` });
      setRecarga((n) => n + 1);
    } catch (e) {
      setAlerta({ tipo: "error", texto: alertaError(e) });
    }
  }

  return (
    <Tarjeta className="flex flex-col gap-5 p-6">
      <TituloPaso
        numero={2}
        titulo="Carga académica"
        subtitulo="Cursos y secciones que dictará el docente"
        derecha={
          docenteId && (
            <Badge tono="celeste" punto>
              {asignaciones.length} {asignaciones.length === 1 ? "sección" : "secciones"} · {horas} h/sem
            </Badge>
          )
        }
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.4fr_1fr]">
        <Selector etiqueta="Docente" valor={docenteId} onCambiar={onDocente}>
          <option value="">Registra o elige un docente</option>
          {docentes.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nombreCompleto}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Año académico" valor={anio?.id ?? ""} onCambiar={onAnio}>
          {anios.map((a) => (
            <option key={a.id} value={a.id}>
              Año {a.anio}
            </option>
          ))}
        </Selector>
      </div>

      {!docenteId ? (
        <Alerta tipo="info" titulo="Primero registra al docente">
          Al guardar sus datos personales podrás asignarle cursos y secciones. También puedes elegir un docente ya
          registrado.
        </Alerta>
      ) : !anio ? (
        <Alerta tipo="info" titulo="Primero crea el año académico" />
      ) : (
        <>
          <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-[1fr_1fr_auto]">
            <Selector
              etiqueta="Sección"
              valor={seccionId}
              onCambiar={(v) => {
                setSeccionId(v);
                setCursoId("");
              }}
            >
              <option value="">Elige la sección</option>
              {listo?.secciones
                .filter((s) => s.estado === "ACTIVA")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {nombreSeccion(s)}
                  </option>
                ))}
            </Selector>
            <Selector etiqueta="Curso" valor={cursoId} onCambiar={setCursoId} deshabilitado={!seccion}>
              <option value="">{seccion ? "Elige el curso" : "Primero elige la sección"}</option>
              {cursosDelGrado.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Selector>
            <Boton variante="exito" icono="icon-plus-blanco" onClick={asignar} cargando={enviando}>
              Asignar
            </Boton>
          </div>
          {seccion && cursosDelGrado.length === 0 && (
            <Alerta
              tipo="aviso"
              icono="alerta-warn"
              titulo={`${seccion.grado.nombre} no tiene cursos en el plan de estudios`}
            >
              Asígnale grados y horas a los cursos en «Cursos y competencias».
            </Alerta>
          )}
          {alerta && (
            <Alerta
              tipo={alerta.tipo}
              icono={alerta.tipo === "exito" ? "icon-check-verde" : undefined}
              titulo={alerta.texto}
            />
          )}
          {errorCarga && <Alerta tipo="error" titulo={errorCarga} />}

          <div className="overflow-x-auto rounded-lg border border-borde">
            <table className="w-full min-w-[520px] text-left text-[14px]">
              <thead className="bg-fondo text-[13px] text-texto-2">
                <tr>
                  <th className="px-4 py-3 font-semibold">Curso</th>
                  <th className="px-4 py-3 font-semibold">Sección</th>
                  <th className="px-4 py-3 text-right font-semibold">Horas/sem</th>
                  <th className="px-4 py-3 font-semibold">Horario</th>
                  <th className="w-12 px-4 py-3">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {!listo && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6">
                      <span className="flex items-center gap-3 text-texto-2">
                        <Spinner claro={false} /> Cargando…
                      </span>
                    </td>
                  </tr>
                )}
                {listo && asignaciones.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-texto-3">
                      Aún no tiene cursos asignados en {anio.anio}.
                    </td>
                  </tr>
                )}
                {asignaciones.map((a) => (
                  <tr key={a.id} className="border-t border-borde">
                    <td className="px-4 py-3 text-texto">{a.curso.nombre}</td>
                    <td className="px-4 py-3 text-texto">
                      {a.grado.numero}° {a.seccion.nombre}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-texto">{a.horasSemanales}</td>
                    <td className="px-4 py-3">
                      {a.horarioPublicado ? (
                        <Badge tono="verde" punto>
                          Publicado
                        </Badge>
                      ) : (
                        <Badge tono="gris">Sin horario</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => quitar(a)}
                        aria-label={`Quitar ${a.curso.nombre} de ${a.grado.numero}° ${a.seccion.nombre}`}
                        className="rounded-md p-1.5 hover:bg-fondo"
                      >
                        <Icono nombre="act-trash" size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="flex gap-2 text-[13px] leading-[1.4] text-texto-3">
            <Icono nombre="icon-info" size={16} />
            No se permite asignar el mismo curso y sección dos veces: “Este docente ya tiene asignado este curso en esta
            sección”.
          </p>
        </>
      )}
    </Tarjeta>
  );
}
