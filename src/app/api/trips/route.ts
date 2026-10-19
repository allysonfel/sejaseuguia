import { apiTraveler, fail, isDate, isTime, ok, readBody, str } from "@/lib/api";
import { DEFAULT_PROFILE } from "@/lib/types";
import { ensureSchema, sql } from "@/lib/db";
import { getDestination, getRules, listPois } from "@/lib/data";
import { generate, haversineKm } from "@/lib/engine";
import { daysBetween } from "@/lib/format";
import { forcedFromReservations, lastDayEnd, newSlug, userRatings } from "@/lib/tripOps";
import type { Reservation, ReservationType } from "@/lib/types";

const TIPOS: ReservationType[] = ["Voo", "Hotel", "Transfer", "Restaurante", "Passeio ou ingresso", "Aluguel de carro", "Seguro"];
const MAX_RESERVAS = 20;

type Body = {
  destinationId: number; inicio: string; fim: string; pax: number; hotel: { nome: string; lat: number; lng: number };
  /** só devolve as atrações que entrariam, sem criar a viagem */
  previa?: boolean;
  /** atrações que a pessoa tirou na prévia (ex.: já conhece o destino) */
  excluir?: number[];
  /** reservas que a pessoa já tem: o roteiro nasce encaixado nelas */
  reservas?: { tipo: string; nome: string; data: string; hora: string; codigo: string; poiId: number }[];
};

type ReservaNova = Omit<Reservation, "id" | "tripId" | "info">;

// Mesmas regras da rota de reservas (campo a campo, lugar só do próprio destino).
function lerReservas(v: unknown, poisDoDestino: Set<number>): ReservaNova[] | string {
  if (v == null) return [];
  if (!Array.isArray(v)) return "Reservas inválidas.";
  if (v.length > MAX_RESERVAS) return "No máximo " + MAX_RESERVAS + " reservas por vez.";
  const out: ReservaNova[] = [];
  for (const x of v as Record<string, unknown>[]) {
    const tipo = TIPOS.includes(x?.tipo as ReservationType) ? (x.tipo as ReservationType) : null;
    if (!tipo) return "Escolha o tipo de cada reserva.";
    const nome = str(x.nome, 120);
    if (!nome) return "Dê um nome para cada reserva.";
    const data = str(x.data, 10) || null;
    if (data && !isDate(data)) return "Data inválida na reserva " + nome + ".";
    const hora = str(x.hora, 5) || null;
    if (hora && !isTime(hora)) return "Horário inválido na reserva " + nome + ". Use o formato 14:30.";
    const poi = Number(x.poiId) || null;
    out.push({ tipo, nome, data, hora, codigo: str(x.codigo, 60) || null, poiId: poi && poisDoDestino.has(poi) ? poi : null });
  }
  return out;
}

// Cria a viagem e já monta o roteiro com o motor. Com `previa`, só mostra as atrações escolhidas.
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

  const todos = await listPois(dest.id, { forEngine: true });
  const reservas = lerReservas(b.reservas, new Set(todos.map((p) => p.id)));
  if (typeof reservas === "string") return fail(reservas);
  const periodo = { inicio, fim };
  const forced = forcedFromReservations(periodo, reservas as Reservation[]);
  // Lugar reservado fica no roteiro mesmo que a pessoa tenha tirado na prévia.
  const reservados = new Set(forced.map((f) => f.poiId));
  const excluir = new Set(Array.isArray(b.excluir) ? b.excluir.slice(0, 500).map(Number).filter((x) => Number.isInteger(x) && !reservados.has(x)) : []);
  const pois = todos.filter((p) => !excluir.has(p.id));
  if (pois.length < 3 && excluir.size) return fail("Sobraram poucas atrações em " + dest.nome + ". Deixe pelo menos 3 no roteiro.");
  if (pois.length < 3) return fail(dest.nome + " ainda tem poucos lugares cadastrados para montar um roteiro.");
  const ctx = {
    pois: Object.fromEntries(pois.map((p) => [p.id, p])),
    hotel, profile: u.profile ?? DEFAULT_PROFILE, rules: await getRules(), inicio,
  };
  const g = generate({ ctx, nDays: n, forced, lastDayEnd: lastDayEnd(periodo, reservas as Reservation[]), ratings: await userRatings(u) });

  if (b.previa) {
    // Só as atrações (refeições o app escolhe sozinho), na ordem dos dias.
    const atracoes = g.days.flatMap((d, i) =>
      d.items.map((it) => ctx.pois[it.p]).filter((p) => p && !p.meal).map((p) => ({ id: p.id, nome: p.nome, cat: p.cat, bairro: p.bairro, dur: p.dur, dia: i + 1, reservada: reservados.has(p.id), resumo: p.historia ?? p.tip ?? null })),
    );
    return ok({ atracoes });
  }

  await ensureSchema();
  // Viagem e reservas juntas: ou entra tudo, ou nada.
  const id = await sql.begin(async (tx) => {
    const [t] = await tx<{ id: number }[]>`
      INSERT INTO trips (owner_id, destination_id, hotel_nome, hotel_lat, hotel_lng, inicio, fim, pax, days, share_slug)
      VALUES (${u.id}, ${dest.id}, ${hotel.nome}, ${hotel.lat}, ${hotel.lng}, ${inicio}, ${fim}, ${pax}, ${sql.json(g.days)}, ${newSlug(dest.nome)})
      RETURNING id`;
    for (const x of reservas)
      await tx`INSERT INTO reservations (trip_id, tipo, nome, data, hora, codigo, poi_id) VALUES (${t.id}, ${x.tipo}, ${x.nome}, ${x.data}, ${x.hora}, ${x.codigo}, ${x.poiId})`;
    return t.id;
  });
  const saved = g.naiveMove > 0 ? Math.max(0, Math.round((1 - g.optimizedMove / g.naiveMove) * 100)) : 0;
  return ok({ id, days: n, activities: g.activities, saved, candidates: g.candidates });
}
