import { PortalApoderado } from "@/components/apoderado/PortalApoderado";

export default function ApoderadoLayout({ children }: { children: React.ReactNode }) {
  return <PortalApoderado>{children}</PortalApoderado>;
}
