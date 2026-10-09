import { redirect } from "next/navigation";
import { requireTraveler } from "@/lib/auth";
import { listTripsForUser, pickActiveTrip } from "@/lib/data";
import Viagem from "../viagem/[id]/page";

// Aba "Roteiro": mostra a viagem ativa direto, sem redirect. O redirect deixava
// a tela em branco (e sem o menu de baixo) até carregar a página da viagem.
export default async function Roteiro({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const u = await requireTraveler();
  const t = pickActiveTrip(await listTripsForUser(u));
  if (!t) redirect("/app/nova-viagem");
  return <Viagem params={Promise.resolve({ id: String(t.id) })} searchParams={searchParams.then((sp) => ({ aba: sp.aba }))} />;
}
