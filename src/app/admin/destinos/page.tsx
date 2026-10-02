import Topbar from "@/components/admin/Topbar";
import DestAdmin from "@/components/admin/DestAdmin";
import { requireStaff } from "@/lib/auth";
import { STALE_DAYS, listDestinations } from "@/lib/data";
import { sql } from "@/lib/db";

export default async function Destinos() {
  await requireStaff("dest");
  const dests = await listDestinations();
  const counts = await sql<{ id: number; pois: number; stale: number; trips: number; reviewed: Date | null }[]>`
    SELECT d.id,
      (SELECT count(*)::int FROM pois p WHERE p.destination_id = d.id AND p.active) AS pois,
      (SELECT count(*)::int FROM pois p WHERE p.destination_id = d.id AND p.active AND p.reviewed_at <= now() - make_interval(days => ${STALE_DAYS})) AS stale,
      (SELECT count(*)::int FROM trips t WHERE t.destination_id = d.id) AS trips,
      (SELECT max(reviewed_at) FROM pois p WHERE p.destination_id = d.id) AS reviewed
    FROM destinations d`;
  const requests = await sql<{ termo: string; c: number }[]>`
    SELECT initcap(lower(termo)) AS termo, count(*)::int AS c FROM destination_requests
    GROUP BY lower(termo), initcap(lower(termo)) ORDER BY c DESC LIMIT 10`;
  const byId = new Map(counts.map((c) => [c.id, { ...c, reviewed: c.reviewed?.toISOString() ?? null }]));
  return (
    <>
      <Topbar title="Destinos" />
      <div className="content">
        <DestAdmin dests={dests.map((d) => ({ ...d, stats: byId.get(d.id) ?? { pois: 0, stale: 0, trips: 0, reviewed: null } }))} requests={requests} />
      </div>
    </>
  );
}
