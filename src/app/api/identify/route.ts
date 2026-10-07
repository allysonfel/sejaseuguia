import { apiTraveler, fail, ok, readBody } from "@/lib/api";
import { sql } from "@/lib/db";
import { identificarLugar } from "@/lib/ia";
import { nearbyPois, validCoords } from "@/lib/nearby";

// "O que é esse lugar?" com foto: lugares perto da localização + a IA olhando
// a foto. Sem IA (sem chave, cota esgotada, erro) devolve só os lugares, como
// antes. A foto não é guardada.

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
  const b = await readBody<{ lat: number; lng: number; foto: string }>(req);
  const lat = Number(b.lat), lng = Number(b.lng);
  if (!validCoords(lat, lng)) return fail("Localização inválida.");

  const pois = await nearbyPois(lat, lng);
  const m = typeof b.foto === "string" ? b.foto.match(/^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/) : null;
  if (!m || !MIMES.includes(m[1]) || m[2].length > MAX_FOTO || !liberado(u.id)) return ok({ pois, ia: null });

  const destId = pois[0]?.destinationId;
  const [dest] = destId ? await sql<{ nome: string }[]>`SELECT nome FROM destinations WHERE id = ${destId}` : [];
  const ia = await identificarLugar(m[2], m[1], dest?.nome ?? null, pois);
  return ok({ pois, ia });
}
