import AppHeader from "@/components/AppHeader";
import { requireTraveler } from "@/lib/auth";
import { sql } from "@/lib/db";
import { dmy } from "@/lib/format";
import PrivacyView from "./PrivacyView";

export default async function Privacidade() {
  const u = await requireTraveler();
  const pending = await sql`SELECT 1 FROM privacy_requests WHERE user_id = ${u.id} AND kind = 'delete' AND status = 'Pendente'`;
  return (
    <>
      <AppHeader title="Privacidade" sub="Seus dados" back="/app/perfil" avatar={u.avatar} />
      <div className="a-body">
        <PrivacyView prefs={u.prefs} deletePending={pending.length > 0} consent={u.consentAt ? dmy(u.consentAt.slice(0, 10)) : null} />
      </div>
    </>
  );
}
