import { notFound } from "next/navigation";
import TripView from "@/components/trip/TripView";
import { getUserById, requireTraveler } from "@/lib/auth";
import { climaDoMes } from "@/lib/clima";
import { getRules, getTripForUser, listMembers, listReservations, poisForTrip, tripStatus } from "@/lib/data";
import { daysBetween, todayIso } from "@/lib/format";
import { appUrl } from "@/lib/mail";
import { acessoDaViagem } from "@/lib/planos";
import { DEFAULT_PROFILE } from "@/lib/types";

export default async function Viagem({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string; dia?: string; novo?: string; a?: string; e?: string }>;
}) {
  const u = await requireTraveler();
  const trip = await getTripForUser(Number((await params).id), u);
  if (!trip) notFound();
  const sp = await searchParams;
  const owner = trip.access === "owner" ? u : await getUserById(trip.ownerId);
  const [pois, reservations, members, rules, clima, acesso] = await Promise.all([
    poisForTrip(trip), listReservations([trip.id]), listMembers(trip.id), getRules(),
    climaDoMes(trip.destinationId, trip.hotel.lat, trip.hotel.lng, trip.inicio), acessoDaViagem(trip),
  ]);
  const today = todayIso();
  const dayFromToday = tripStatus(trip, today) === "Em andamento" ? daysBetween(trip.inicio, today) : 0;
  const dia = sp.dia != null && Number(sp.dia) >= 0 && Number(sp.dia) < trip.days.length ? Number(sp.dia) : dayFromToday;
  const banner = sp.novo
    ? { festa: true, t: "Roteiro pronto!", d: `${trip.days.length} ${trip.days.length === 1 ? "dia" : "dias"}, ${sp.a ?? ""} atividades${Number(sp.e) > 0 ? " e " + sp.e + "% menos deslocamento do que visitar tudo na ordem da lista" : ""}.` }
    : null;
  return (
    <TripView
      key={trip.version}
      trip={trip}
      pois={pois}
      profile={owner?.profile ?? DEFAULT_PROFILE}
      rules={rules}
      clima={clima}
      reservations={reservations}
      members={members}
      ownerName={owner?.nome ?? "Organizador"}
      initialTab={["roteiro", "mapa", "reservas", "pessoas"].includes(sp.aba ?? "") ? (sp.aba as "roteiro") : "roteiro"}
      initialDay={dia}
      initialBanner={banner}
      shareUrl={appUrl() + "/v/" + trip.shareSlug}
      acesso={acesso}
    />
  );
}
