import AdminNav from "@/components/admin/AdminNav";
import { allowedModules, requireStaff } from "@/lib/auth";
import { initials } from "@/lib/format";
import { agencyName } from "@/lib/mail";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const u = await requireStaff();
  const mods = await allowedModules(u);
  return (
    <div className="adm">
      <AdminNav mods={mods} agency={agencyName()} me={{ nome: u.nome, role: u.staffRole ?? "", ini: initials(u.nome) }} />
      <div className="main">{children}</div>
    </div>
  );
}
