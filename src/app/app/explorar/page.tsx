import Explore from "@/components/Explore";
import { getUserById, requireTraveler } from "@/lib/auth";
import { getRules, listDestinations, listTripsForUser, pickActiveTrip, poisForTrip, listPois, tripStatus } from "@/lib/data";
import { daysBetween, todayIso } from "@/lib/format";
import { DEFAULT_PROFILE } from "@/lib/types";

export default async function Explorar() {
  const u = await requireTraveler();
  const trip = pickActiveTrip(await listTripsForUser(u));
  const rules = await getRules();
  if (!trip) {
    const dest = (await listDestinations({ published: true }))[0];
    const pois = dest ? await listPois(dest.id, { forEngine: true }) : [];
    return <Explore trip={null} pois={Object.fromEntries(pois.map((p) => [p.id, p]))} profile={u.profile} rules={rules} center={dest ?? { lat: 0, lng: 0, nome: "" }} dayIdx={0} geo={u.prefs.location} />;
  }
  const owner = trip.access === "owner" ? u : await getUserById(trip.ownerId);
  const today = todayIso();
  return (
    <Explore
      trip={trip}
      pois={await poisForTrip(trip)}
      profile={owner?.profile ?? DEFAULT_PROFILE}
      rules={rules}
      center={{ ...trip.hotel }}
      dayIdx={tripStatus(trip, today) === "Em andamento" ? daysBetween(trip.inicio, today) : 0}
      geo={u.prefs.location}
    />
  );
}
