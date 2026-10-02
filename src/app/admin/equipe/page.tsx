import Topbar from "@/components/admin/Topbar";
import TeamAdmin from "@/components/admin/TeamAdmin";
import { getPermissions, requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";

export default async function Equipe() {
  const me = await requireStaff("team");
  const staff = await sql<{ id: number; nome: string; email: string; staff_role: string; last_seen_at: Date | null }[]>`
    SELECT id, nome, email, staff_role, last_seen_at FROM users WHERE kind = 'staff' ORDER BY created_at`;
  const reqs = await sql<{ id: number; user_nome: string; user_email: string; kind: "export" | "delete"; status: string; created_at: Date; user_id: number | null }[]>`
    SELECT id, user_nome, user_email, kind, status, created_at, user_id FROM privacy_requests ORDER BY status = 'Pendente' DESC, created_at DESC LIMIT 50`;
  const [lgpd] = await sql<{ total: number; consent: number }[]>`
    SELECT count(*)::int AS total, count(consent_at)::int AS consent FROM users WHERE kind = 'traveler'`;
  return (
    <>
      <Topbar title="Equipe e LGPD" />
      <div className="content">
        <TeamAdmin
          meId={me.id}
          staff={staff.map((s) => ({ id: s.id, nome: s.nome, email: s.email, role: s.staff_role, seen: s.last_seen_at?.toISOString() ?? null }))}
          perms={await getPermissions()}
          requests={reqs.map((r) => ({ id: r.id, nome: r.user_nome, email: r.user_email, kind: r.kind, status: r.status, at: r.created_at.toISOString(), gone: !r.user_id }))}
          lgpd={lgpd}
        />
      </div>
    </>
  );
}
