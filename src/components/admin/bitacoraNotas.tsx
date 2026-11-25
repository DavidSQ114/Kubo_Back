// AD-16 · Auditoría · pestaña «Cambios de notas» (US03): bitácora de notas de solo lectura con filtros por rango de
// fechas y por docente (se cumplen los dos), del cambio más reciente al más antiguo y paginada. Cada fila dice quién,
// cuándo, curso, sección, bimestre, estudiante, competencia, valor anterior → nuevo y si vino del registro del docente
// o de una rectificación aprobada (US41).
"use client";

import { useEffect, useState } from "react";
import { Selector } from "@/components/admin/grados";
import { alertaError } from "@/components/admin/PortalAdmin";
import { BadgeLogro, type Logro } from "@/components/docente/notas";
import { Alerta, Badge, Boton, Campo, Spinner, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";
import { fechaHora } from "@/lib/formato";

interface CambioRegistrado {
  id: string;
  fecha: string;
  origen: "REGISTRO" | "RECTIFICACION";
  nombreOrigen: string;
  solicitudId: string | null;
  docente: { id: string; nombre: string };
  realizadoPor: { id: string; nombre: string };
  anio: number;
  curso: { codigo: string; nombre: string };
  seccion: string;
  bimestre: { numero: number; nombre: string };
  estudiante: string;
  competencia: { columna: string; codigo: string; nombre: string };
  valorAnterior: Logro | null;
  valorNuevo: Logro | null;
}

interface Pagina {
  items: CambioRegistrado[];
  paginacion: { pagina: number; tamano: number; total: number; paginas: number };
}

interface Filtros {
  desde: string;
  hasta: string;
  docenteId: string;
  pagina: number;
}

const FILTROS_INICIALES: Filtros = { desde: "", hasta: "", docenteId: "", pagina: 1 };
const TAMANO_PAGINA = 20;

function SinValor() {
  return (
    <span
      title="Primer registro de la nota"
      className="inline-flex h-9 w-12 items-center justify-center rounded-md border border-borde bg-white text-[14px] text-texto-3"
    >
      —
    </span>
  );
}

export function BitacoraNotas() {
  const [borrador, setBorrador] = useState<Filtros>(FILTROS_INICIALES);
  const [aplicados, setAplicados] = useState<Filtros>(FILTROS_INICIALES);
  const [estado, setEstado] = useState<{ clave: string; pagina?: Pagina; error?: string } | null>(null);
  const [intento, setIntento] = useState(0);
  const [docentes, setDocentes] = useState<{ id: string; nombre: string }[]>([]);
  const [errorFiltro, setErrorFiltro] = useState<string | null>(null);

  const clave = `${JSON.stringify(aplicados)}-${intento}`;
  useEffect(() => {
    let vigente = true;
    const q = new URLSearchParams({ pagina: String(aplicados.pagina), tamano: String(TAMANO_PAGINA) });
    if (aplicados.desde) q.set("desde", aplicados.desde);
    if (aplicados.hasta) q.set("hasta", aplicados.hasta);
    if (aplicados.docenteId) q.set("docenteId", aplicados.docenteId);
    api<Pagina>(`/evaluacion/bitacora?${q}`)
      .then((pagina) => vigente && setEstado({ clave, pagina }))
      .catch((e) => vigente && setEstado({ clave, error: alertaError(e) }));
    return () => {
      vigente = false;
    };
  }, [aplicados, clave]);

  useEffect(() => {
    let vigente = true;
    api<{ id: string; nombre: string }[]>("/evaluacion/bitacora/docentes")
      .then((d) => vigente && setDocentes(d))
      .catch(() => vigente && setDocentes([]));
    return () => {
      vigente = false;
    };
  }, []);

  function aplicar() {
    if (borrador.desde && borrador.hasta && borrador.desde > borrador.hasta) {
      setErrorFiltro("La fecha «Desde» no puede ser posterior a la fecha «Hasta».");
      return;
    }
    setErrorFiltro(null);
    setAplicados({ ...borrador, pagina: 1 });
  }

  const actual = estado?.clave === clave ? estado : null;
  const pagina = actual?.pagina;
  const conFiltros = !!(aplicados.desde || aplicados.hasta || aplicados.docenteId);
  return (
    <Tarjeta className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44">
          <Campo
            etiqueta="Desde"
            type="date"
            value={borrador.desde}
            onChange={(e) => setBorrador((b) => ({ ...b, desde: e.target.value }))}
          />
        </div>
        <div className="w-44">
          <Campo
            etiqueta="Hasta"
            type="date"
            value={borrador.hasta}
            onChange={(e) => setBorrador((b) => ({ ...b, hasta: e.target.value }))}
          />
        </div>
        <div className="w-64">
          <Selector
            etiqueta="Docente"
            valor={borrador.docenteId}
            onCambiar={(v) => setBorrador((b) => ({ ...b, docenteId: v }))}
          >
            <option value="">Todos los docentes</option>
            {docentes.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </Selector>
        </div>
        <Boton icono="icon-sliders" onClick={aplicar}>
          Aplicar filtros
        </Boton>
        <span className="ml-auto">
          <Badge tono="gris">Solo lectura</Badge>
        </span>
      </div>
      {errorFiltro && <Alerta tipo="error" titulo={errorFiltro} />}
      {!actual && (
        <div className="flex items-center gap-3 text-[14px] text-texto-2" role="status">
          <Spinner claro={false} /> Cargando la bitácora…
        </div>
      )}
      {actual?.error && (
        <Alerta tipo="error" titulo="No pudimos cargar la bitácora de notas">
          {actual.error}{" "}
          <button
            type="button"
            onClick={() => setIntento((n) => n + 1)}
            className="font-semibold text-kubo-azul underline"
          >
            Reintentar
          </button>
        </Alerta>
      )}
      {pagina && pagina.items.length === 0 && (
        <p className="rounded-lg border border-borde bg-fondo px-4 py-8 text-center text-[14px] text-texto-2">
          {conFiltros
            ? "No hay cambios de notas con estos filtros. Prueba con otro rango de fechas u otro docente."
            : "Aún no hay cambios de notas. Aparecen aquí cuando un docente registra o cambia una nota."}
        </p>
      )}
      {pagina && pagina.items.length > 0 && (
        <>
          <p className="text-[13px] text-texto-3">
            {`${pagina.paginacion.total} ${pagina.paginacion.total === 1 ? "registro" : "registros"} · del más reciente al más antiguo`}
          </p>
          <div className="overflow-x-auto rounded-lg border border-borde">
            <table className="w-full min-w-[960px] border-collapse text-left text-[14px]">
              <thead>
                <tr className="border-b border-borde bg-fondo text-[13px] font-semibold text-texto-2">
                  {["Fecha y hora", "Docente", "Curso", "Estudiante", "Comp.", "Valor anterior → nuevo", "Origen"].map(
                    (t) => (
                      <th key={t} scope="col" className="px-4 py-3">
                        {t}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {pagina.items.map((c) => (
                  <tr key={c.id} className="border-b border-borde align-middle last:border-b-0">
                    <td className="px-4 py-3 whitespace-nowrap text-texto">{fechaHora(new Date(c.fecha))}</td>
                    <td className="px-4 py-3 text-texto">
                      {c.docente.nombre}
                      {c.origen === "RECTIFICACION" && (
                        <span className="block text-[12px] text-texto-3">{`aprobó ${c.realizadoPor.nombre}`}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block text-texto">{c.curso.nombre}</span>
                      <span className="block text-[12px] text-texto-3">{`${c.seccion} · ${c.bimestre.nombre} ${c.anio}`}</span>
                    </td>
                    <td className="px-4 py-3 text-texto">{c.estudiante}</td>
                    <td className="px-4 py-3 text-texto" title={c.competencia.nombre}>
                      {c.competencia.columna}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        {c.valorAnterior ? <BadgeLogro logro={c.valorAnterior} /> : <SinValor />}
                        <span aria-hidden className="text-texto-3">
                          ›
                        </span>
                        {c.valorNuevo ? <BadgeLogro logro={c.valorNuevo} /> : <SinValor />}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tono={c.origen === "RECTIFICACION" ? "azul" : "gris"}>{c.nombreOrigen}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagina.paginacion.paginas > 1 && (
            <div className="flex items-center justify-end gap-3 text-[13px] text-texto-2">
              <Boton
                variante="secundario"
                disabled={aplicados.pagina <= 1}
                onClick={() => setAplicados((a) => ({ ...a, pagina: a.pagina - 1 }))}
              >
                Anterior
              </Boton>
              {`Página ${pagina.paginacion.pagina} de ${pagina.paginacion.paginas}`}
              <Boton
                variante="secundario"
                disabled={aplicados.pagina >= pagina.paginacion.paginas}
                onClick={() => setAplicados((a) => ({ ...a, pagina: a.pagina + 1 }))}
              >
                Siguiente
              </Boton>
            </div>
          )}
        </>
      )}
    </Tarjeta>
  );
}
