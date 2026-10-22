// Inicio temporal para Docente, Apoderado y Alumno hasta que se construyan sus portales.
// El Docente ve aquí «Mis cursos»: sus cursos y secciones asignados (US14, criterio 1).
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PaginaCentrada, TarjetaAcceso } from "@/components/acceso";
import { Alerta, Boton, Spinner } from "@/components/ui";
import { api, cerrarSesion, destinoPorErrorDeSesion, inicioPorRol, NOMBRE_ROL, type Rol, type Sesion } from "@/lib/api";

interface MiCurso {
  id: string;
  anio: { anio: number };
  curso: { nombre: string };
  grado: { numero: number };
  seccion: { nombre: string };
  horasSemanales: number;
}

/** Cursos y secciones asignados al docente en sesión. */
function MisCursos() {
  const [cursos, setCursos] = useState<MiCurso[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<MiCurso[]>("/academico/mis-cursos")
      .then(setCursos)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <Alerta tipo="error" titulo={error} />;
  if (!cursos) return <Spinner claro={false} />;
  return (
    <section className="flex w-full flex-col gap-2" aria-label="Mis cursos">
      <h2 className="text-[18px] font-semibold text-texto">Mis cursos</h2>
      {cursos.length === 0 ? (
        <p className="text-[14px] text-texto-3">Aún no tienes cursos asignados. Consulta con el administrador.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-borde rounded-lg border border-borde">
          {cursos.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3 text-[14px]">
              <span className="flex-1 font-semibold text-texto">{c.curso.nombre}</span>
              <span className="text-texto-2">
                {c.grado.numero}° {c.seccion.nombre}
              </span>
              <span className="text-texto-3">{c.anio.anio}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function InicioPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);

  useEffect(() => {
    api<Sesion>("/identidad/sesion")
      .then((s) => {
        if (s.debeCambiarPassword) router.replace("/cambiar-password");
        else if (s.rolActivo === "ADMINISTRADOR") router.replace(inicioPorRol(s.rolActivo));
        else setSesion(s);
      })
      .catch((e) => router.replace(destinoPorErrorDeSesion(e) ?? "/login"));
  }, [router]);

  async function cambiar(rol: Rol) {
    await api("/identidad/sesion/perfil", { method: "PUT", body: { rol } });
    router.replace(inicioPorRol(rol));
  }

  if (!sesion) {
    return (
      <PaginaCentrada>
        <Spinner claro={false} />
      </PaginaCentrada>
    );
  }

  return (
    <PaginaCentrada>
      <TarjetaAcceso>
        <h1 className="text-[24px] font-semibold leading-[1.25] text-texto">Hola, {sesion.usuario.nombres}</h1>
        <Alerta
          tipo="info"
          titulo={`El portal de ${NOMBRE_ROL[sesion.rolActivo].toLowerCase()} estará disponible pronto`}
        >
          Tu sesión está activa. Estamos construyendo las pantallas de horarios, notas, asistencia y pagos.
        </Alerta>
        {sesion.rolActivo === "DOCENTE" && <MisCursos />}
        {sesion.perfiles
          .filter((p) => p !== sesion.rolActivo)
          .map((p) => (
            <Boton key={p} variante="secundario" ancho onClick={() => cambiar(p)}>
              Ingresar como {NOMBRE_ROL[p]}
            </Boton>
          ))}
        <Boton
          ancho
          onClick={async () => {
            await cerrarSesion();
            router.replace("/login");
          }}
        >
          Cerrar sesión
        </Boton>
      </TarjetaAcceso>
    </PaginaCentrada>
  );
}
