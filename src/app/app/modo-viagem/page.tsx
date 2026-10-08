import { redirect } from "next/navigation";
import { requireTraveler } from "@/lib/auth";
import { listTripsForUser, pickActiveTrip } from "@/lib/data";
import ModoViagemPage from "../viagem/[id]/modo-viagem/page";

// Aba "Modo viagem": mesma ideia do /app/roteiro, renderiza a viagem ativa sem redirect.
export default async function ModoViagem() {
  const u = await requireTraveler();
  const t = pickActiveTrip(await listTripsForUser(u));
  if (!t) redirect("/app/nova-viagem");
  return <ModoViagemPage params={Promise.resolve({ id: String(t.id) })} />;
}
