import { PortalAlumno } from "@/components/alumno/PortalAlumno";

export default function AlumnoLayout({ children }: { children: React.ReactNode }) {
  return <PortalAlumno>{children}</PortalAlumno>;
}
