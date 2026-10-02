import { STALE_DAYS } from "./data";
import { ensureSchema, sql } from "./db";
import { todayIso } from "./format";

const n = (v: unknown) => Number(v ?? 0);

export async function overviewStats() {
  await ensureSchema();
  const today = todayIso();
  const [u] = await sql`
    SELECT count(*) AS total, count(*) FILTER (WHERE created_at >= date_trunc('month', now())) AS novos
    FROM users WHERE kind = 'traveler'`;
  const [t] = await sql`
    SELECT count(*) FILTER (WHERE created_at >= date_trunc('month', now())) AS mes,
           count(*) FILTER (WHERE created_at >= date_trunc('month', now()) - interval '1 month' AND created_at < date_trunc('month', now())) AS anterior,
           count(*) FILTER (WHERE inicio <= ${today} AND fim >= ${today}) AS agora,
           count(*) AS total
    FROM trips`;
  const [r] = await sql`
    SELECT count(*) FILTER (WHERE created_at >= date_trunc('month', now())) AS mes, count(*) AS total,
           count(DISTINCT trip_id) AS viagens
    FROM replan_events WHERE kind <> 'undo'`;
  const [p] = await sql`
    SELECT count(*) FILTER (WHERE active) AS ativos,
           count(*) FILTER (WHERE active AND reviewed_at > now() - interval '30 days') AS recentes,
           count(*) FILTER (WHERE active AND reviewed_at <= now() - make_interval(days => ${STALE_DAYS})) AS desatualizados,
           count(*) FILTER (WHERE NOT active) AS inativos
    FROM pois`;
  const series = await sql<{ dia: string; roteiros: string; replans: string }[]>`
    SELECT to_char(d, 'DD/MM') AS dia,
           (SELECT count(*) FROM trips WHERE created_at::date = d::date) AS roteiros,
           (SELECT count(*) FROM replan_events WHERE kind <> 'undo' AND created_at::date = d::date) AS replans
    FROM generate_series(current_date - 13, current_date, interval '1 day') d ORDER BY d`;
  const dest = await sql<{ nome: string; c: string }[]>`
    SELECT d.nome, count(t.id) AS c FROM destinations d LEFT JOIN trips t ON t.destination_id = d.id
    GROUP BY d.id ORDER BY c DESC, d.nome LIMIT 6`;
  const reasons = await sql<{ kind: string; c: string }[]>`
    SELECT kind, count(*) AS c FROM replan_events WHERE kind <> 'undo' GROUP BY kind ORDER BY c DESC LIMIT 6`;
  const requests = await sql<{ termo: string; c: string }[]>`
    SELECT initcap(lower(termo)) AS termo, count(*) AS c FROM destination_requests
    WHERE created_at > now() - interval '90 days' GROUP BY lower(termo), initcap(lower(termo)) ORDER BY c DESC LIMIT 5`;
  const reasonTotal = reasons.reduce((a, x) => a + n(x.c), 0);
  return {
    travelers: n(u.total), newTravelers: n(u.novos),
    tripsMonth: n(t.mes), tripsPrev: n(t.anterior), tripsNow: n(t.agora), tripsTotal: n(t.total),
    replansMonth: n(r.mes), replansPerTrip: n(r.viagens) ? n(r.total) / n(r.viagens) : 0,
    poisActive: n(p.ativos), poisRecentPct: n(p.ativos) ? Math.round((n(p.recentes) / n(p.ativos)) * 100) : 0,
    poisStale: n(p.desatualizados), poisInactive: n(p.inativos),
    series: series.map((s) => ({ dia: s.dia, a: n(s.roteiros), b: n(s.replans) })),
    dest: dest.map((d) => ({ nome: d.nome, c: n(d.c) })),
    reasons: reasons.map((x) => ({ kind: x.kind, pct: reasonTotal ? Math.round((n(x.c) / reasonTotal) * 100) : 0 })),
    requests: requests.map((x) => ({ termo: x.termo, c: n(x.c) })),
  };
}
