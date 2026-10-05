import AppHeader from "@/components/AppHeader";
import { requireTraveler } from "@/lib/auth";
import { listDestinations } from "@/lib/data";
import { todayIso } from "@/lib/format";
import NewTripForm from "./NewTripForm";

export default async function NovaViagem() {
  const u = await requireTraveler();
  const dests = await listDestinations({ published: true });
  return (
    <>
      <AppHeader title="Nova viagem" sub="Passo único" back="/app" avatar={u.avatar} />
      <div className="a-body">
        <NewTripForm destinations={dests} profile={u.profile} today={todayIso()} />
      </div>
    </>
  );
}
