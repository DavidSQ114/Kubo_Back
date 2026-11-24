// DO-05 · Aula virtual · Docente (US61, US62): el docente elige uno de sus cursos y secciones del año en curso y
// gestiona sus enlaces de clase virtual (M-17), sus unidades didácticas y sus materiales de estudio (M-16): los publica,
// los oculta o los elimina. En un año que ya no está en curso, el aula se muestra en solo lectura.
"use client";

import { useState } from "react";
import {
  ListaUnidades,
  ModalEliminar,
  ModalEnlace,
  ModalSubirMaterial,
  Panel,
  TablaMateriales,
  TarjetaEnlace,
  type AulaDelDocente,
  type CursosDelAula,
  type EnlaceVista,
  type MaterialVista,
} from "@/components/docente/aulaVirtual";
import { EncabezadoPagina, mensajeError } from "@/components/portal";
import { CargandoAula, ErrorAula } from "@/components/portal/aulaVirtual";
import { AsistenciaVacia, useConsulta } from "@/components/portal/asistencia";
import { Alerta, Boton, Icono } from "@/components/ui";
import { api } from "@/lib/api";
import { cantidad } from "@/lib/formato";

type Modal =
  | { tipo: "material" }
  | { tipo: "enlace"; enlace: EnlaceVista | null }
  | { tipo: "eliminar-material"; material: MaterialVista }
  | { tipo: "eliminar-enlace"; enlace: EnlaceVista }
  | null;

/** «3 publicados, 1 en borrador y 1 oculto» (subtítulo de «Materiales de estudio» en DO-05). */
function resumenMateriales(materiales: MaterialVista[]) {
  const n = (estado: MaterialVista["estado"]) => materiales.filter((m) => m.estado === estado).length;
  const partes = [
    n("PUBLICADO") && cantidad(n("PUBLICADO"), "publicado", "publicados"),
    n("BORRADOR") && `${n("BORRADOR")} en borrador`,
    n("OCULTO") && cantidad(n("OCULTO"), "oculto", "ocultos"),
  ].filter(Boolean) as string[];
  return partes.length > 1 ? `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}` : (partes[0] ?? "");
}

function AulaDeCurso({ asignacionId }: { asignacionId: string }) {
  const { carga, reintentar } = useConsulta<AulaDelDocente>(`/aula-virtual/asignaciones/${asignacionId}`);
  // los cambios de esta sesión se guardan sobre lo cargado; al cambiar de curso, `key` reinicia el componente
  const [cambios, setCambios] = useState<AulaDelDocente | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [aviso, setAviso] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);

  if (carga.fase === "cargando") return <CargandoAula />;
  if (carga.fase === "error") return <ErrorAula mensaje={carga.mensaje} onReintentar={reintentar} />;
  const aula = cambios ?? carga.datos;
  const actualizar = (parcial: Partial<AulaDelDocente>, texto?: string) => {
    setCambios({ ...aula, ...parcial });
    if (texto) setAviso({ tipo: "exito", texto });
  };
  const error = (texto: string) => setAviso({ tipo: "error", texto });
  const conMaterial = (m: MaterialVista) => {
    const existe = aula.materiales.some((x) => x.id === m.id);
    return existe ? aula.materiales.map((x) => (x.id === m.id ? m : x)) : [m, ...aula.materiales];
  };
  const conEnlace = (e: EnlaceVista) => {
    const existe = aula.enlaces.some((x) => x.id === e.id);
    const lista = existe ? aula.enlaces.map((x) => (x.id === e.id ? e : x)) : [...aula.enlaces, e];
    return lista.sort((a, b) => (a.inicio ?? "").localeCompare(b.inicio ?? ""));
  };
  const hayUnidadActiva = aula.unidades.some((u) => u.activo);

  async function cambiarVisibilidad(e: EnlaceVista) {
    try {
      const r = await api<EnlaceVista>(`/aula-virtual/enlaces/${e.id}/${e.visible ? "ocultar" : "publicar"}`, {
        method: "POST",
      });
      actualizar(
        { enlaces: conEnlace(r) },
        r.visible ? `«${r.titulo}» ya es visible para tus alumnos.` : `«${r.titulo}» quedó oculto para tus alumnos.`,
      );
    } catch (err) {
      error(mensajeError(err));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {!aula.editable && (
        <Alerta tipo="info" titulo={`El año ${aula.anio.anio} ya no está en curso`}>
          Puedes revisar y descargar lo que publicaste, pero ya no crear, publicar, ocultar ni eliminar.
        </Alerta>
      )}
      {aviso && (
        <Alerta tipo={aviso.tipo} titulo={aviso.texto}>
          <button type="button" onClick={() => setAviso(null)} className="font-semibold text-kubo-azul underline">
            Cerrar
          </button>
        </Alerta>
      )}

      <Panel
        icono="icon-video"
        titulo="Clase virtual y enlaces"
        descripcion={`Tus alumnos de ${aula.seccion.etiqueta} ven estos enlaces en su pantalla «Mis cursos».`}
        accion={
          aula.editable && (
            <Boton
              variante="secundario"
              icono="icon-plus-gris"
              onClick={() => setModal({ tipo: "enlace", enlace: null })}
            >
              Agregar enlace
            </Boton>
          )
        }
      >
        {aula.enlaces.length === 0 ? (
          <p className="rounded-lg bg-fondo px-4 py-3 text-[14px] text-texto-2">
            Aún no registras enlaces. Agrega el de tu clase virtual, una asesoría o un taller.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {aula.enlaces.map((e) => (
              <TarjetaEnlace
                key={e.id}
                enlace={e}
                editable={aula.editable}
                onEditar={() => setModal({ tipo: "enlace", enlace: e })}
                onVisibilidad={() => cambiarVisibilidad(e)}
                onEliminar={() => setModal({ tipo: "eliminar-enlace", enlace: e })}
                onCopiado={(ok) =>
                  ok ? setAviso({ tipo: "exito", texto: "Enlace copiado." }) : error("No se pudo copiar el enlace.")
                }
              />
            ))}
          </ul>
        )}
        <p className="flex items-start gap-2 text-[13px] text-texto-3">
          <Icono nombre="icon-info" size={16} className="mt-0.5" />
          El estado del enlace (Programado, Activo o Finalizado) lo calcula el sistema con la fecha y la hora de Lima.
          Tú solo defines si es visible para los alumnos.
        </p>
      </Panel>

      <Panel
        icono="icon-capas"
        titulo="Unidades didácticas"
        descripcion="Organizan tus materiales. Una unidad desactivada y sus materiales no se muestran a los alumnos."
      >
        <ListaUnidades aula={aula} onCambio={(unidades) => actualizar({ unidades })} onError={error} />
      </Panel>

      <Panel
        icono="icon-documento"
        titulo="Materiales de estudio"
        descripcion={
          aula.materiales.length
            ? `${resumenMateriales(aula.materiales)} en ${aula.curso.nombre} · ${aula.seccion.etiqueta}.`
            : `Aún no hay materiales en ${aula.curso.nombre} · ${aula.seccion.etiqueta}.`
        }
        accion={
          aula.editable && (
            <Boton icono="icon-subir-blanco" disabled={!hayUnidadActiva} onClick={() => setModal({ tipo: "material" })}>
              Subir material
            </Boton>
          )
        }
      >
        {aula.editable && !hayUnidadActiva && (
          <Alerta tipo="aviso" titulo="Crea una unidad para subir materiales">
            Cada material se publica dentro de una unidad didáctica activa.
          </Alerta>
        )}
        {aula.materiales.length > 0 && (
          <TablaMateriales
            aula={aula}
            onCambio={(m, texto) => actualizar({ materiales: conMaterial(m) }, texto)}
            onEliminar={(m) => setModal({ tipo: "eliminar-material", material: m })}
            onError={error}
          />
        )}
        <p className="flex items-start gap-2 text-[13px] text-texto-3">
          <Icono nombre="icon-info" size={16} className="mt-0.5" />
          Un material en borrador nunca fue visible; uno oculto sí lo estuvo y dejó de serlo. En ambos casos el alumno
          no lo ve ni lo puede descargar.
        </p>
      </Panel>

      {modal?.tipo === "material" && (
        <ModalSubirMaterial
          aula={aula}
          onCerrar={() => setModal(null)}
          onSubido={(m) => {
            setModal(null);
            actualizar(
              { materiales: conMaterial(m) },
              m.estado === "PUBLICADO"
                ? `«${m.titulo}» quedó publicado para tus alumnos de ${aula.seccion.etiqueta}.`
                : `«${m.titulo}» quedó guardado como borrador.`,
            );
          }}
        />
      )}
      {modal?.tipo === "enlace" && (
        <ModalEnlace
          aula={aula}
          enlace={modal.enlace}
          onCerrar={() => setModal(null)}
          onGuardado={(e, nuevo) => {
            setModal(null);
            actualizar(
              { enlaces: conEnlace(e) },
              nuevo ? `Se guardó el enlace «${e.titulo}».` : `Se actualizó el enlace «${e.titulo}».`,
            );
          }}
        />
      )}
      {modal?.tipo === "eliminar-material" && (
        <ModalEliminar
          que="el material"
          nombre={modal.material.titulo}
          onCerrar={() => setModal(null)}
          onConfirmar={async () => {
            await api(`/aula-virtual/materiales/${modal.material.id}`, { method: "DELETE" });
            setModal(null);
            actualizar(
              { materiales: aula.materiales.filter((m) => m.id !== modal.material.id) },
              `Se eliminó «${modal.material.titulo}».`,
            );
          }}
        />
      )}
      {modal?.tipo === "eliminar-enlace" && (
        <ModalEliminar
          que="el enlace"
          nombre={modal.enlace.titulo}
          onCerrar={() => setModal(null)}
          onConfirmar={async () => {
            await api(`/aula-virtual/enlaces/${modal.enlace.id}`, { method: "DELETE" });
            setModal(null);
            actualizar(
              { enlaces: aula.enlaces.filter((e) => e.id !== modal.enlace.id) },
              `Se eliminó el enlace «${modal.enlace.titulo}».`,
            );
          }}
        />
      )}
    </div>
  );
}

export default function AulaVirtualDocentePage() {
  const { carga, reintentar } = useConsulta<CursosDelAula>("/aula-virtual/docente/cursos");
  const [elegida, setElegida] = useState<string | null>(null);
  const cursos = carga.fase === "listo" ? carga.datos.cursos : [];
  const asignacionId = elegida ?? cursos[0]?.asignacionId ?? null;

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo="Aula virtual"
        descripcion="Publica los materiales de estudio y los enlaces de clase virtual de las secciones que tienes a cargo."
      />
      {carga.fase === "cargando" && <CargandoAula />}
      {carga.fase === "error" && <ErrorAula mensaje={carga.mensaje} onReintentar={reintentar} />}
      {carga.fase === "listo" && cursos.length === 0 && (
        <AsistenciaVacia titulo="No tienes cursos en el año en curso" icono="nav-book-azul">
          {carga.datos.anio
            ? `Cuando el Administrador te asigne cursos del año ${carga.datos.anio.anio}, podrás publicar aquí sus materiales y enlaces.`
            : "Aún no hay un año académico en curso. Cuando empiece, verás aquí tus cursos y secciones."}
        </AsistenciaVacia>
      )}
      {cursos.length > 0 && asignacionId && (
        <>
          <nav aria-label="Cursos y secciones" className="-mx-1 overflow-x-auto border-b border-borde">
            <ul className="flex min-w-max gap-1 px-1">
              {cursos.map((c) => {
                const activa = c.asignacionId === asignacionId;
                return (
                  <li key={c.asignacionId}>
                    <button
                      type="button"
                      onClick={() => setElegida(c.asignacionId)}
                      aria-current={activa ? "page" : undefined}
                      className={`border-b-2 px-3 py-3 text-[15px] whitespace-nowrap ${activa ? "border-kubo-azul font-semibold text-kubo-azul" : "border-transparent text-texto-2 hover:text-texto"}`}
                    >
                      {c.curso.nombre} · {c.etiqueta}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          <AulaDeCurso key={asignacionId} asignacionId={asignacionId} />
        </>
      )}
    </div>
  );
}
