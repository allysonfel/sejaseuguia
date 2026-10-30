import { apiTraveler, fail, ok, readBody } from "@/lib/api";
import { podeUsarAgora } from "@/lib/planos";
import { sql } from "@/lib/db";
import { identificarLugar } from "@/lib/ia";
import { nearbyPois, validCoords } from "@/lib/nearby";

// "O que é esse lugar?" com foto: lugares perto da localização + a IA olhando
// a foto. Sem IA (sem chave, cota esgotada, erro) devolve só os lugares, como
// antes. Sem localização (negada ou demorou), a IA reconhece só pela foto,
// usando o destino da viagem como pista. A foto não é guardada.

const MAX_FOTO = 1_500_000; // base64 (~1,1 MB); o app manda a foto reduzida para 1024 px
const MIMES = ["image/jpeg", "image/png", "image/webp"];

// Limite simples por viajante para não esgotar a cota gratuita da IA.
const JANELA = 10 * 60_000, MAX_POR_JANELA = 15;
const usos = new Map<number, number[]>();
function liberado(userId: number) {
  const agora = Date.now();
  const l = (usos.get(userId) ?? []).filter((t) => agora - t < JANELA);
  if (l.length >= MAX_POR_JANELA) return false;
  l.push(agora);
  usos.set(userId, l);
  return true;
}

export async function POST(req: Request) {
  const u = await apiTraveler();
  if (!u) return fail("Entre de novo para continuar.", 401);
  const b = await readBody<{ lat?: number | null; lng?: number | null; foto: string; destinationId?: number | null }>(req);
  const lat = Number(b.lat), lng = Number(b.lng);
  const temLocal = b.lat != null && b.lng != null && validCoords(lat, lng);
  const m = typeof b.foto === "string" ? b.foto.match(/^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/) : null;
  const fotoOk = !!m && MIMES.includes(m[1]) && m[2].length <= MAX_FOTO;
  if (!temLocal && !fotoOk) return fail("Localização inválida.");
  if (fotoOk && !(await podeUsarAgora(u.id, "foto")))
    return fail("O O que é? pela foto faz parte do plano Completo da viagem e vale de 48 horas antes até o fim dela.", 402);

  const pois = temLocal ? await nearbyPois(lat, lng) : [];
  if (!fotoOk || !liberado(u.id)) return ok({ pois, ia: null });

  const destId = pois[0]?.destinationId ?? (Number.isInteger(Number(b.destinationId)) ? Number(b.destinationId) : null);
  const [dest] = destId ? await sql<{ nome: string }[]>`SELECT nome FROM destinations WHERE id = ${destId}` : [];
  const ia = await identificarLugar(m![2], m![1], dest?.nome ?? null, pois);
  return ok({ pois, ia });
}
