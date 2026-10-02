import { notFound } from "next/navigation";
import TravelMode from "@/components/trip/TravelMode";
import { getUserById, requireTraveler } from "@/lib/auth";
import { getDestination, getRules, getTripForUser, poisForTrip, tripStatus } from "@/lib/data";
import { daysBetween, todayIso } from "@/lib/format";
import { DEFAULT_PROFILE } from "@/lib/types";

export default async function ModoViagemPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireTraveler();
  const trip = await getTripForUser(Number((await params).id), u);
  if (!trip) notFound();
  const owner = trip.access === "owner" ? u : await getUserById(trip.ownerId);
  const [pois, rules, dest] = await Promise.all([poisForTrip(trip), getRules(), getDestination(trip.destinationId)]);
  const today = todayIso();
  const status = tripStatus(trip, today);
  return (
    <TravelMode
      key={trip.version}
      trip={trip}
      pois={pois}
      profile={owner?.profile ?? DEFAULT_PROFILE}
      rules={rules}
      live={status === "Em andamento"}
      dayIdx={status === "Em andamento" ? daysBetween(trip.inicio, today) : 0}
      note={
        status === "Planejada" ? "A viagem começa em " + daysBetween(today, trip.inicio) + " dias. Esta é uma prévia de como o Dia 1 vai funcionar." :
        status === "Encerrada" ? "Esta viagem já terminou. Você está revendo o Dia 1." : null
      }
      center={dest ?? trip.hotel}
    />
  );
}
