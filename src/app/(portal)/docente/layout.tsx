import { PortalDocente } from "@/components/docente/PortalDocente";

export default function DocenteLayout({ children }: { children: React.ReactNode }) {
  return <PortalDocente>{children}</PortalDocente>;
}
