import { apiTraveler, fail, isDate, ok, readBody, str } from "@/lib/api";
import { DEFAULT_PROFILE } from "@/lib/types";
import { getDestination, getRules, listPois } from "@/lib/data";
import { haversineKm } from "@/lib/engine";
import { daysBetween } from "@/lib/format";
import { geminiDisponivel, pesquisarRoteiro } from "@/lib/iaRoteiro";

type Body = { destinationId: number; inicio: string; fim: string; hotel: { nome: string; lat: number; lng: number } };

// Começa a pesquisa do roteiro (Gemini) assim que destino, datas e hospedagem estão preenchidos.
// Responde na hora; a prévia e a montagem reaproveitam a mesma pesquisa (leva de 1 a 2 min).
export async function POST(req: Request) {
  const u = await apiTraveler();
  if (!u) return fail("Entre de novo para continuar.", 401);
  if (!geminiDisponivel()) return ok({ iniciada: false });
  const b = await readBody<Body>(req);
  const dest = await getDestination(Number(b.destinationId));
  if (!dest) return fail("Escolha um destino da lista.");
  const inicio = str(b.inicio, 10), fim = str(b.fim, 10);
  if (!isDate(inicio) || !isDate(fim)) return fail("Informe as datas de ida e volta.");
  const n = daysBetween(inicio, fim) + 1;
  if (n < 1 || n > 21) return ok({ iniciada: false });
  const hotel = { nome: str(b.hotel?.nome, 120), lat: Number(b.hotel?.lat), lng: Number(b.hotel?.lng) };
  if (!hotel.nome || !Number.isFinite(hotel.lat) || !Number.isFinite(hotel.lng) || haversineKm(hotel, dest) > 80) return ok({ iniciada: false });
  const todos = await listPois(dest.id, { forEngine: true });
  const profile = u.profile ?? DEFAULT_PROFILE;
  const regras = await getRules();
  void pesquisarRoteiro({ userId: u.id, dest, inicio, fim, nDias: n, hotel, profile, porDia: regras.porRitmo[profile.ritmo] ?? 5, catalogo: todos });
  return ok({ iniciada: true });
}
