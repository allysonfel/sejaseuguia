import { apiTraveler, fail, isDate, ok, readBody, str } from "@/lib/api";
import { DEFAULT_PROFILE } from "@/lib/types";
import { ensureSchema, sql } from "@/lib/db";
import { getDestination, getRules, listPois } from "@/lib/data";
import { generate, haversineKm } from "@/lib/engine";
import { daysBetween } from "@/lib/format";
import { newSlug, userRatings } from "@/lib/tripOps";

type Body = { destinationId: number; inicio: string; fim: string; pax: number; hotel: { nome: string; lat: number; lng: number } };

// Cria a viagem e já monta o roteiro com o motor.
export async function POST(req: Request) {
  const u = await apiTraveler();
  if (!u) return fail("Entre de novo para continuar.", 401);
  const b = await readBody<Body>(req);
  const dest = await getDestination(Number(b.destinationId));
  if (!dest) return fail("Escolha um destino da lista.");
  const inicio = str(b.inicio, 10), fim = str(b.fim, 10);
  if (!isDate(inicio) || !isDate(fim)) return fail("Informe as datas de ida e volta.");
  const n = daysBetween(inicio, fim) + 1;
  if (n < 1) return fail("A volta precisa ser depois da ida.");
  if (n > 21) return fail("Por enquanto o roteiro cobre até 21 dias.");
  const hotel = { nome: str(b.hotel?.nome, 120), lat: Number(b.hotel?.lat), lng: Number(b.hotel?.lng) };
  if (!hotel.nome) return fail("Informe a hospedagem.");
  if (!Number.isFinite(hotel.lat) || !Number.isFinite(hotel.lng)) return fail("Marque a hospedagem no mapa.");
  if (haversineKm(hotel, dest) > 80) return fail("A hospedagem marcada está longe de " + dest.nome + ". Confira o lugar no mapa.");
  const pax = Math.min(20, Math.max(1, Math.round(Number(b.pax) || 1)));

  const pois = await listPois(dest.id, { forEngine: true });
  if (pois.length < 3) return fail(dest.nome + " ainda tem poucos lugares cadastrados para montar um roteiro.");
  const ctx = {
    pois: Object.fromEntries(pois.map((p) => [p.id, p])),
    hotel, profile: u.profile ?? DEFAULT_PROFILE, rules: await getRules(), inicio,
  };
  const g = generate({ ctx, nDays: n, forced: [], lastDayEnd: null, ratings: await userRatings(u) });

  await ensureSchema();
  const [{ id }] = await sql<{ id: number }[]>`
    INSERT INTO trips (owner_id, destination_id, hotel_nome, hotel_lat, hotel_lng, inicio, fim, pax, days, share_slug)
    VALUES (${u.id}, ${dest.id}, ${hotel.nome}, ${hotel.lat}, ${hotel.lng}, ${inicio}, ${fim}, ${pax}, ${sql.json(g.days)}, ${newSlug(dest.nome)})
    RETURNING id`;
  const saved = g.naiveMove > 0 ? Math.max(0, Math.round((1 - g.optimizedMove / g.naiveMove) * 100)) : 0;
  return ok({ id, days: n, activities: g.activities, saved, candidates: g.candidates });
}
