// AD-01 · Inicio del Administrador (bloque M1): accesos a usuarios, espacios, parámetros del sistema, asistencia
// docente y auditoría. Lo académico, la matrícula y los pagos están en el portal del Coordinador académico.
"use client";

import { InicioGestion, type AccesoInicio } from "@/components/admin/inicio";

const ACCESOS: AccesoInicio[] = [
  {
    href: "/admin/usuarios",
    titulo: "Usuarios",
    descripcion: "Registra cuentas de todos los roles, modifica sus datos y suspende, reactiva o desbloquea accesos.",
    icono: "kpi-users",
  },
  {
    href: "/admin/espacios",
    titulo: "Espacios",
    descripcion: "Registra las aulas del colegio con su aforo, modifícalas o desactívalas.",
    icono: "icon-puerta",
  },
  {
    href: "/admin/parametros",
    titulo: "Parámetros del sistema",
    descripcion: "Ajusta los intentos de inicio de sesión, los umbrales de asistencia y las horas de la jornada.",
    icono: "icon-sliders",
  },
  {
    href: "/admin/asistencia-docente",
    titulo: "Asistencia docente",
    descripcion: "Registra el ingreso y la salida del personal docente y justifica sus faltas.",
    icono: "icon-calendar",
  },
  {
    href: "/admin/auditoria",
    titulo: "Auditoría y errores",
    descripcion: "Consulta quién hizo cada operación crítica y los errores registrados por el sistema.",
    icono: "icon-lock",
  },
];

export default function InicioAdminPage() {
  return <InicioGestion descripcion="Este es tu panel de administración de Kubo." accesos={ACCESOS} />;
}
