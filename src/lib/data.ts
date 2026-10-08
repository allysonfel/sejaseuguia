import { ensureSchema, getSetting, sql } from "./db";
import type { User } from "./auth";
import { todayIso } from "./format";
import {
  DEFAULT_RULES, type DayPlan, type Destination, type Poi, type Reservation, type ReservationType,
  type Rules, type Trip, type TripMember, type TripStatus,
} from "./types";

import { isStale } from "./stale";
export { STALE_DAYS, isStale } from "./stale";

type PoiRow = {
  id: number; destination_id: number; nome: string; cat: string; bairro: string; lat: number; lng: number;
  dur: number; abre: string; fecha: string; preco: number; reserva: boolean; indoor: boolean; meal: boolean;
  tags: string[]; closed_days: number[]; tip: string | null; historia: string | null;
  curiosidades: string[]; datas: { ano: string; txt: string }[]; source: string; reviewed_at: Date; active: boolean;
};

export function mapPoi(r: PoiRow): Poi {
  return {
    id: r.id, destinationId: r.destination_id, nome: r.nome, cat: r.cat, bairro: r.bairro, lat: r.lat, lng: r.lng,
    dur: r.dur, abre: r.abre, fecha: r.fecha, preco: r.preco, reserva: r.reserva, indoor: r.indoor, meal: r.meal,
    tags: r.tags, closedDays: r.closed_days, tip: r.tip, historia: r.historia, curiosidades: r.curiosidades,
    datas: r.datas, source: r.source, reviewedAt: r.reviewed_at.toISOString(), active: r.active,
  };
}


/** Lugares de um destino. Para o motor, só os ativos e revisados recentemente. */
export async function listPois(destinationId: number, opts: { forEngine?: boolean } = {}): Promise<Poi[]> {
  await ensureSchema();
  const rows = await sql<PoiRow[]>`SELECT * FROM pois WHERE destination_id = ${destinationId} ORDER BY nome`;
  const all = rows.map(mapPoi);
  return opts.forEngine ? all.filter((p) => p.active && !isStale(p)) : all;
}

/** Lugares de um destino mais os que já estão no roteiro (mesmo se desativados depois). */
export async function poisForTrip(trip: Trip): Promise<Record<number, Poi>> {
  const list = await listPois(trip.destinationId);
  const used = new Set(trip.days.flatMap((d) => d.items.map((i) => i.p)));
  const out: Record<number, Poi> = {};
  for (const p of list) if ((p.active && !isStale(p)) || used.has(p.id)) out[p.id] = p;
  return out;
}

type DestRow = { id: number; nome: string; pais: string; lat: number; lng: number; moeda: string; update_freq: string; cor1: string; cor2: string; foto_url: string | null; foto_credito: string | null };
const mapDest = (r: DestRow): Destination => ({
  id: r.id, nome: r.nome, pais: r.pais, lat: r.lat, lng: r.lng, moeda: r.moeda, updateFreq: r.update_freq, cor1: r.cor1, cor2: r.cor2,
  fotoUrl: r.foto_url, fotoCredito: r.foto_credito,
});

/** published: só os que já têm lugar liberado (os recém-importados esperam a revisão da equipe). */
export async function listDestinations(opts: { published?: boolean } = {}): Promise<Destination[]> {
  await ensureSchema();
  const rows = opts.published
    ? await sql<DestRow[]>`SELECT * FROM destinations d WHERE EXISTS (SELECT 1 FROM pois p WHERE p.destination_id = d.id AND p.active) ORDER BY nome`
    : await sql<DestRow[]>`SELECT * FROM destinations ORDER BY nome`;
  return rows.map(mapDest);
}

export async function getDestination(id: number): Promise<Destination | null> {
  await ensureSchema();
  const r = await sql<DestRow[]>`SELECT * FROM destinations WHERE id = ${id}`;
  return r[0] ? mapDest(r[0]) : null;
}

export async function getRules(): Promise<Rules & { version: number; publishedAt: string }> {
  return getSetting("rules", { ...DEFAULT_RULES, version: 1, publishedAt: new Date().toISOString() });
}

type TripRow = {
  id: number; owner_id: number; destination_id: number; destino: string; pais: string; moeda: string; cor1: string; cor2: string; foto_url: string | null; foto_credito: string | null;
  hotel_nome: string; hotel_lat: number; hotel_lng: number; inicio: string; fim: string; pax: number; days: DayPlan[];
  version: number; share_slug: string; share_public: boolean; hide_res: boolean; created_at: Date;
};

const tripSelect = () => sql`
  SELECT t.id, t.owner_id, t.destination_id, d.nome AS destino, d.pais, d.moeda, d.cor1, d.cor2, d.foto_url, d.foto_credito,
         t.hotel_nome, t.hotel_lat, t.hotel_lng, t.inicio::text AS inicio, t.fim::text AS fim, t.pax, t.days,
         t.version, t.share_slug, t.share_public, t.hide_res, t.created_at
  FROM trips t JOIN destinations d ON d.id = t.destination_id`;

export function mapTrip(r: TripRow): Trip {
  return {
    id: r.id, ownerId: r.owner_id, destinationId: r.destination_id, destino: r.destino, pais: r.pais, moeda: r.moeda,
    cor1: r.cor1, cor2: r.cor2, fotoUrl: r.foto_url, fotoCredito: r.foto_credito, hotel: { nome: r.hotel_nome, lat: r.hotel_lat, lng: r.hotel_lng },
    inicio: r.inicio, fim: r.fim, pax: r.pax, days: r.days, version: r.version, shareSlug: r.share_slug,
    sharePublic: r.share_public, hideRes: r.hide_res, createdAt: r.created_at.toISOString(),
  };
}

export function tripStatus(t: { inicio: string; fim: string }, today = todayIso()): TripStatus {
  if (today < t.inicio) return "Planejada";
  if (today > t.fim) return "Encerrada";
  return "Em andamento";
}

export type TripAccess = "owner" | "editor" | "viewer";

/** A viagem "da vez": em andamento; senão a próxima; senão a última que terminou. */
export function pickActiveTrip<T extends Trip>(trips: T[], today = todayIso()): T | null {
  const now = trips.find((t) => tripStatus(t, today) === "Em andamento");
  if (now) return now;
  const next = trips.filter((t) => t.inicio > today).sort((a, b) => a.inicio.localeCompare(b.inicio))[0];
  if (next) return next;
  return trips.slice().sort((a, b) => b.fim.localeCompare(a.fim))[0] ?? null;
}

/** Viagens que a pessoa organiza ou para as quais foi convidada. */
export async function listTripsForUser(u: User): Promise<(Trip & { access: TripAccess })[]> {
  await ensureSchema();
  const rows = await sql<(TripRow & { member_role: string | null })[]>`
    SELECT x.*, m.role AS member_role FROM (${tripSelect()}) x
    LEFT JOIN trip_members m ON m.trip_id = x.id AND lower(m.email) = lower(${u.email})
    WHERE x.owner_id = ${u.id} OR m.id IS NOT NULL
    ORDER BY x.inicio`;
  return rows.map((r) => ({ ...mapTrip(r), access: r.owner_id === u.id ? "owner" : (r.member_role as TripAccess) }));
}

export async function getTripForUser(id: number, u: User): Promise<(Trip & { access: TripAccess }) | null> {
  if (!Number.isInteger(id)) return null;
  await ensureSchema();
  const rows = await sql<(TripRow & { member_role: string | null })[]>`
    SELECT x.*, m.role AS member_role FROM (${tripSelect()}) x
    LEFT JOIN trip_members m ON m.trip_id = x.id AND lower(m.email) = lower(${u.email})
    WHERE x.id = ${id} AND (x.owner_id = ${u.id} OR m.id IS NOT NULL)`;
  const r = rows[0];
  if (!r) return null;
  return { ...mapTrip(r), access: r.owner_id === u.id ? "owner" : (r.member_role as TripAccess) };
}

export async function getTripBySlug(slug: string): Promise<Trip | null> {
  await ensureSchema();
  const rows = await sql<TripRow[]>`SELECT * FROM (${tripSelect()}) x WHERE x.share_slug = ${slug}`;
  return rows[0] ? mapTrip(rows[0]) : null;
}

type ResRow = { id: number; trip_id: number; tipo: ReservationType; nome: string; data: string | null; hora: string | null; codigo: string | null; info: string | null; poi_id: number | null };
const mapRes = (r: ResRow): Reservation => ({
  id: r.id, tripId: r.trip_id, tipo: r.tipo, nome: r.nome, data: r.data, hora: r.hora, codigo: r.codigo, info: r.info, poiId: r.poi_id,
});

export async function listReservations(tripIds: number[]): Promise<Reservation[]> {
  if (!tripIds.length) return [];
  await ensureSchema();
  const rows = await sql<ResRow[]>`
    SELECT id, trip_id, tipo, nome, data::text AS data, hora, codigo, info, poi_id FROM reservations
    WHERE trip_id IN ${sql(tripIds)} ORDER BY data NULLS LAST, hora NULLS LAST, id`;
  return rows.map(mapRes);
}

export async function listMembers(tripId: number): Promise<TripMember[]> {
  await ensureSchema();
  return sql<TripMember[]>`
    SELECT m.id, m.email, u.nome, m.role, u.id AS "userId" FROM trip_members m
    LEFT JOIN users u ON lower(u.email) = lower(m.email) AND u.kind = 'traveler'
    WHERE m.trip_id = ${tripId} ORDER BY m.created_at`;
}

/** Média das notas da pessoa por categoria (alimenta as próximas sugestões). */
export async function ratingsByCategory(userId: number): Promise<Record<string, number>> {
  await ensureSchema();
  const rows = await sql<{ cat: string; avg: string }[]>`
    SELECT p.cat, avg(r.stars) AS avg FROM ratings r JOIN pois p ON p.id = r.poi_id
    WHERE r.user_id = ${userId} GROUP BY p.cat`;
  return Object.fromEntries(rows.map((r) => [r.cat, Number(r.avg)]));
}

export async function logActivity(tripId: number, userId: number, texto: string) {
  await sql`INSERT INTO trip_activity (trip_id, user_id, texto) VALUES (${tripId}, ${userId}, ${texto})`;
}

export async function logReplan(tripId: number, userId: number, kind: string) {
  await sql`INSERT INTO replan_events (trip_id, user_id, kind) VALUES (${tripId}, ${userId}, ${kind})`;
}
