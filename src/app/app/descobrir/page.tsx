import AppHeader from "@/components/AppHeader";
import Discover from "@/components/Discover";
import { getUserById, requireTraveler } from "@/lib/auth";
import { getRules, listTripsForUser, mapPoi, pickActiveTrip, poisForTrip, tripStatus } from "@/lib/data";
import { sql } from "@/lib/db";
import { daysBetween, todayIso } from "@/lib/format";
import { DEFAULT_PROFILE } from "@/lib/types";

export default async function Descobrir() {
  const u = await requireTraveler();
  const trip = pickActiveTrip(await listTripsForUser(u));
  const found = (await sql<(Parameters<typeof mapPoi>[0] & { found_at: Date })[]>`
    SELECT p.*, d.created_at AS found_at FROM discoveries d JOIN pois p ON p.id = d.poi_id
    WHERE d.user_id = ${u.id} ORDER BY d.created_at DESC LIMIT 30`).map((r) => ({ ...mapPoi(r), foundAt: r.found_at.toISOString() }));
  const today = todayIso();
  const owner = trip && trip.access !== "owner" ? await getUserById(trip.ownerId) : u;
  return (
    <>
      <AppHeader title="O que é esse lugar?" sub="Fotografe e descubra" avatar={u.avatar} />
      <Discover
        found={found}
        trip={trip}
        pois={trip ? await poisForTrip(trip) : {}}
        profile={owner?.profile ?? DEFAULT_PROFILE}
        rules={await getRules()}
        geo={u.prefs.location}
        dayIdx={trip && tripStatus(trip, today) === "Em andamento" ? daysBetween(trip.inicio, today) : 0}
      />
    </>
  );
}
