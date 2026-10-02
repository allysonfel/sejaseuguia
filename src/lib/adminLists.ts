import { ensureSchema, sql } from "./db";
import { todayIso } from "./format";
import type { Profile, TripStatus } from "./types";

export type TravelerRow = { id: number; nome: string; email: string; profile: Profile | null; viagens: number; created_at: Date; last_seen_at: Date | null };

export async function listTravelers(q = ""): Promise<{ rows: TravelerRow[]; total: number }> {
  await ensureSchema();
  const like = "%" + q.trim().toLowerCase() + "%";
  const rows = await sql<TravelerRow[]>`
    SELECT u.id, u.nome, u.email, u.profile, u.created_at, u.last_seen_at,
           (SELECT count(*)::int FROM trips t WHERE t.owner_id = u.id) AS viagens
    FROM users u WHERE u.kind = 'traveler'
      ${q.trim() ? sql`AND (lower(u.nome) LIKE ${like} OR lower(u.email) LIKE ${like})` : sql``}
    ORDER BY u.last_seen_at DESC NULLS LAST, u.created_at DESC LIMIT 500`;
  const [{ count }] = await sql<{ count: string }[]>`SELECT count(*) FROM users WHERE kind = 'traveler'`;
  return { rows, total: Number(count) };
}

export type TripRow = { id: number; destino: string; organizador: string; inicio: string; fim: string; dias: number; pax: number; replans: number; status: TripStatus };

export async function listAllTrips(status?: TripStatus): Promise<TripRow[]> {
  await ensureSchema();
  const today = todayIso();
  const rows = await sql<Omit<TripRow, "status">[]>`
    SELECT t.id, d.nome AS destino, u.nome AS organizador, t.inicio::text AS inicio, t.fim::text AS fim,
           jsonb_array_length(t.days) AS dias, t.pax,
           (SELECT count(*)::int FROM replan_events r WHERE r.trip_id = t.id AND r.kind <> 'undo') AS replans
    FROM trips t JOIN destinations d ON d.id = t.destination_id JOIN users u ON u.id = t.owner_id
    WHERE 1=1
      ${status === "Planejada" ? sql`AND t.inicio > ${today}` : sql``}
      ${status === "Em andamento" ? sql`AND t.inicio <= ${today} AND t.fim >= ${today}` : sql``}
      ${status === "Encerrada" ? sql`AND t.fim < ${today}` : sql``}
    ORDER BY t.inicio DESC LIMIT 500`;
  return rows.map((r) => ({ ...r, status: today < r.inicio ? "Planejada" : today > r.fim ? "Encerrada" : "Em andamento" }));
}
