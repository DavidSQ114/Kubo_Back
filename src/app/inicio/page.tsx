// Inicio temporal para Docente, Apoderado y Alumno hasta que se construyan sus portales.
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PaginaCentrada, TarjetaAcceso } from "@/components/acceso";
import { Alerta, Boton, Spinner } from "@/components/ui";
import { api, cerrarSesion, destinoPorErrorDeSesion, inicioPorRol, NOMBRE_ROL, type Rol, type Sesion } from "@/lib/api";

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
        <Alerta tipo="info" titulo={`El portal de ${NOMBRE_ROL[sesion.rolActivo].toLowerCase()} estará disponible pronto`}>
          Tu sesión está activa. Estamos construyendo las pantallas de horarios, notas, asistencia y pagos.
        </Alerta>
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
