// Espacios del colegio (aulas físicas, US09) en el portal del Administrador (bloque M1): formulario para registrar o
// modificar un aula y tabla con su aforo, la sección que la usa en el año elegido y su ocupación, con las acciones
// de editar y desactivar o activar. Antes era el bloque «Aulas físicas» de AD-03.
"use client";

import { FormularioAula, BarraOcupacion, nombreSeccion, type Aula } from "@/components/admin/grados";
import { Icono, Tarjeta } from "@/components/ui";

export function BloqueAulas({
  aulas,
  total,
  resumen,
  editando,
  onVerTodas,
  onEditar,
  onCancelar,
  onCambiarEstado,
  onGuardado,
}: {
  aulas: Aula[];
  total: number;
  resumen: boolean;
  editando: Aula | null;
  onVerTodas: () => void;
  onEditar: (a: Aula) => void;
  onCancelar: () => void;
  onCambiarEstado: (a: Aula, activo: boolean) => void;
  onGuardado: (mensaje: string) => void;
}) {
  return (
    <Tarjeta className="flex flex-col gap-5 p-6">
      <div className="flex items-start gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">Aulas físicas</h2>
          <p className="text-[14px] leading-[1.4] text-texto-3">Registra cada ambiente con su capacidad máxima</p>
        </div>
        {resumen && total > aulas.length && (
          <button
            type="button"
            onClick={onVerTodas}
            className="flex items-center gap-1 text-[16px] font-semibold text-kubo-azul hover:underline"
          >
            Ver todas <Icono nombre="pag-chevr" size={20} />
          </button>
        )}
      </div>

      <FormularioAula key={editando?.id ?? "nueva"} aula={editando} onCancelar={onCancelar} onGuardado={onGuardado} />

      <div className="overflow-x-auto rounded-lg border border-borde">
        <table className="w-full min-w-[720px] border-collapse bg-white text-left">
          <thead>
            <tr className="border-b border-borde bg-fondo text-[13px] font-semibold leading-[1.4] text-texto-2">
              <th className="px-4 py-3 font-semibold">Aula</th>
              <th className="px-4 py-3 font-semibold">Ubicación</th>
              <th className="w-[80px] px-4 py-3 text-right font-semibold">Aforo</th>
              <th className="px-4 py-3 font-semibold">Sección asignada</th>
              <th className="w-[150px] px-4 py-3 font-semibold">Ocupación</th>
              <th className="w-[80px] px-2 py-3">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {aulas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[14px] text-texto-3">
                  Aún no hay aulas registradas.
                </td>
              </tr>
            )}
            {aulas.map((a) => {
              const ocupados = a.secciones.reduce((n, s) => n + s.matriculados, 0);
              return (
                <tr
                  key={a.id}
                  className={`border-b border-borde text-[14px] leading-[1.4] last:border-b-0 ${a.activo ? "text-texto" : "text-texto-3"}`}
                >
                  <td className="px-4 py-4 font-semibold whitespace-nowrap">
                    {a.nombre}
                    {!a.activo && <span className="ml-2 text-[12px] font-normal">(desactivada)</span>}
                  </td>
                  <td className="px-4 py-4">{a.ubicacion ?? "—"}</td>
                  <td className="px-4 py-4 text-right tabular-nums">{a.aforo}</td>
                  <td className="px-4 py-4">
                    {a.secciones.length ? a.secciones.map((s) => nombreSeccion(s)).join(", ") : "Sin sección"}
                  </td>
                  <td className="px-4 py-4">
                    {a.secciones.length ? (
                      <BarraOcupacion ocupados={ocupados} total={a.aforo} />
                    ) : (
                      <span className="text-[13px] text-texto-3">—</span>
                    )}
                  </td>
                  <td className="px-2 py-4">
                    <div className="flex justify-end gap-0.5">
                      <Accion icono="act-edit" texto={`Editar ${a.nombre}`} onClick={() => onEditar(a)} />
                      {a.activo ? (
                        <Accion
                          icono="act-ban"
                          texto={`Desactivar ${a.nombre}`}
                          onClick={() => onCambiarEstado(a, false)}
                        />
                      ) : (
                        <Accion
                          icono="act-refresh"
                          texto={`Activar ${a.nombre}`}
                          onClick={() => onCambiarEstado(a, true)}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Tarjeta>
  );
}

export function Accion({ icono, texto, onClick }: { icono: string; texto: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={texto}
      aria-label={texto}
      className="rounded-md p-[7px] hover:bg-fondo"
    >
      <Icono nombre={icono} size={18} />
    </button>
  );
}
