// /inicio · Redirige al portal del perfil activo. Fue el inicio temporal del Docente y del Alumno hasta que tuvieron
// su portal (/docente y /alumno, sprint 3); se conserva para los enlaces guardados.
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PaginaCentrada } from "@/components/acceso";
import { Spinner } from "@/components/ui";
import { api, destinoPorErrorDeSesion, inicioPorRol, type Sesion } from "@/lib/api";

export default function InicioPage() {
  const router = useRouter();

  useEffect(() => {
    api<Sesion>("/identidad/sesion")
      .then((s) => router.replace(s.debeCambiarPassword ? "/cambiar-password" : inicioPorRol(s.rolActivo)))
      .catch((e) => router.replace(destinoPorErrorDeSesion(e) ?? "/login"));
  }, [router]);

  return (
    <PaginaCentrada>
      <Spinner claro={false} />
    </PaginaCentrada>
  );
}
