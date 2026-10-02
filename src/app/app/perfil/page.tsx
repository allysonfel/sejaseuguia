import AppHeader from "@/components/AppHeader";
import TabBar from "@/components/TabBar";
import { requireTraveler } from "@/lib/auth";
import ProfileView from "./ProfileView";

export default async function Perfil() {
  const u = await requireTraveler();
  return (
    <>
      <AppHeader title="Perfil" sub="Conta e preferências" avatar={u.avatar} />
      <div className="a-body">
        <ProfileView nome={u.nome} email={u.email} avatar={u.avatar} profile={u.profile} support={process.env.AGENCY_SUPPORT_EMAIL || null} agency={process.env.AGENCY_NAME || "Lux Viagens e Turismo"} />
      </div>
      <TabBar />
    </>
  );
}
