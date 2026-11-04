import AppHeader from "@/components/AppHeader";
import { requireTraveler } from "@/lib/auth";
import { dmy } from "@/lib/format";
import PrivacyView from "./PrivacyView";
import { avisosDo } from "@/lib/notifications";

export default async function Privacidade() {
  const u = await requireTraveler();
  return (
    <>
      <AppHeader title="Privacidade" sub="Seus dados" back="/app/perfil" avatar={u.avatar} notifs={await avisosDo(u)} />
      <div className="a-body">
        <PrivacyView prefs={u.prefs} consent={u.consentAt ? dmy(u.consentAt.slice(0, 10)) : null} />
      </div>
    </>
  );
}
