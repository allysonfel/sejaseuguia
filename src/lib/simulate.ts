import { listPois, listReservations } from "./data";
import { sql } from "./db";
import { generate, schedAll, type Ctx } from "./engine";
import { daysBetween } from "./format";
import { forcedFromReservations, lastDayEnd } from "./tripOps";
import { DEFAULT_PROFILE, type Poi, type Profile, type Rules } from "./types";

export type SimMetrics = { trips: number; moveDay: number; actsDay: number; conflicts: number; longWalkDays: number };

/** Gera de novo as últimas viagens com duas versões de regras e compara os resultados. */
export async function simulate(draft: Rules, published: Rules, limit = 60): Promise<{ draft: SimMetrics; published: SimMetrics }> {
  const trips = await sql<{ id: number; destination_id: number; hotel_nome: string; hotel_lat: number; hotel_lng: number; inicio: string; fim: string; profile: Profile | null }[]>`
    SELECT t.id, t.destination_id, t.hotel_nome, t.hotel_lat, t.hotel_lng, t.inicio::text AS inicio, t.fim::text AS fim, u.profile
    FROM trips t JOIN users u ON u.id = t.owner_id ORDER BY t.created_at DESC LIMIT ${limit}`;
  const poisByDest = new Map<number, Record<number, Poi>>();
  const res = await listReservations(trips.map((t) => t.id));
  const run = async (rules: Rules): Promise<SimMetrics> => {
    let days = 0, move = 0, acts = 0, conflicts = 0, longWalk = 0;
    for (const t of trips) {
      if (!poisByDest.has(t.destination_id))
        poisByDest.set(t.destination_id, Object.fromEntries((await listPois(t.destination_id, { forEngine: true })).map((p) => [p.id, p])));
      const pois = poisByDest.get(t.destination_id)!;
      const ctx: Ctx = { pois, hotel: { nome: t.hotel_nome, lat: t.hotel_lat, lng: t.hotel_lng }, profile: t.profile ?? DEFAULT_PROFILE, rules, inicio: t.inicio };
      const r = res.filter((x) => x.tripId === t.id);
      const forced = forcedFromReservations(t, r).filter((f) => pois[f.poiId]);
      const g = generate({ ctx, nDays: daysBetween(t.inicio, t.fim) + 1, forced, lastDayEnd: lastDayEnd(t, r) });
      for (const s of schedAll(g.days, ctx)) {
        days++;
        move += s.moveMin;
        acts += s.items.length;
        conflicts += s.items.filter((i) => i.warn || i.late).length;
        if (s.walk > 8) longWalk++;
      }
    }
    return { trips: trips.length, moveDay: days ? move / days : 0, actsDay: days ? acts / days : 0, conflicts, longWalkDays: longWalk };
  };
  return { draft: await run(draft), published: await run(published) };
}
