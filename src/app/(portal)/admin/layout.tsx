import { PortalAdmin } from "@/components/admin/PortalAdmin";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <PortalAdmin>{children}</PortalAdmin>;
}
