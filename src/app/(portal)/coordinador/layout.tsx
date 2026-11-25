// Portal del Coordinador académico (bloque M1): menú y guardia de sesión de las páginas /coordinador.
import { PortalCoordinador } from "@/components/coordinador/PortalCoordinador";

export default function CoordinadorLayout({ children }: { children: React.ReactNode }) {
  return <PortalCoordinador>{children}</PortalCoordinador>;
}
