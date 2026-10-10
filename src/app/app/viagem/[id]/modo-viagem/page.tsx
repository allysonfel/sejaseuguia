import { notFound } from "next/navigation";
import TravelMode from "@/components/trip/TravelMode";
import { getUserById, requireTraveler } from "@/lib/auth";
import { getDestination, getRules, getTripForUser, poisForTrip, tripStatus } from "@/lib/data";
import { daysBetween, todayIso } from "@/lib/format";
import { DEFAULT_PROFILE } from "@/lib/types";

export default async function ModoViagemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ dia?: string }> }) {
  const u = await requireTraveler();
  const trip = await getTripForUser(Number((await params).id), u);
  if (!trip) notFound();
  const owner = trip.access === "owner" ? u : await getUserById(trip.ownerId);
  const [pois, rules, dest] = await Promise.all([poisForTrip(trip), getRules(), getDestination(trip.destinationId)]);
  const today = todayIso();
  const status = tripStatus(trip, today);
  const hoje = status === "Em andamento" ? daysBetween(trip.inicio, today) : 0;
  // ?dia=N: dia aberto pelo viajante (ver ou adiantar outro dia); sem ele, o dia de hoje
  const pedido = Number((await searchParams)?.dia);
  const inicial = Number.isInteger(pedido) && pedido >= 0 && pedido < trip.days.length ? pedido : hoje;
  return (
    <TravelMode
      key={trip.version}
      trip={trip}
      pois={pois}
      profile={owner?.profile ?? DEFAULT_PROFILE}
      rules={rules}
      live={status === "Em andamento"}
      dayIdx={hoje}
      inicial={inicial}
      status={status}
      faltam={status === "Planejada" ? daysBetween(today, trip.inicio) : 0}
      center={dest ?? trip.hotel}
    />
  );
}
