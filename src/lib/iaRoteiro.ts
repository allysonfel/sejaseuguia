// Roteiro híbrido: o Gemini pesquisa no Google e escolhe os lugares de cada dia (horário do período,
// ingresso, agendamento, preço, restaurante perto); o motor continua organizando ordem, horários e trajetos.
// Lugar que não está no catálogo entra no banco como automático não revisado (fonte "Gemini").
// Falhou, demorou ou passou do limite: devolve null e o motor monta sozinho, como antes.
// Chave paga (os dados não vão para treino): GEMINI_API_KEY. Modelo: GEMINI_ROTEIRO_MODEL.

import { sql } from "./db";
import { mapPoi } from "./data";
import { POI_CATS, type Destination, type Poi, type Profile } from "./types";

export type LugarIA = {
  /** id do catálogo, quando o Gemini escolheu um lugar que já temos */
  id: number | null;
  nome: string;
  cat: string;
  bairro: string;
  lat: number;
  lng: number;
  dur: number;
  abre: string;
  fecha: string;
  fechadoDias: number[];
  preco: number;
  reserva: boolean;
  indoor: boolean;
  meal: boolean;
  /** dia sugerido, a partir de 1 */
  dia: number;
  dica: string;
};

export type PedidoRoteiro = {
  userId: number;
  dest: Destination;
  inicio: string;
  fim: string;
  nDias: number;
  hotel: { nome: string; lat: number; lng: number };
  profile: Profile;
  porDia: number;
  catalogo: Poi[];
};

const TIMEOUT_MS = 150_000;
// Pesquisas por viajante em 24 h (cada uma custa e faz ~12 buscas no Google).
const JANELA = 24 * 60 * 60_000, MAX_POR_JANELA = 15;
const CACHE_MS = 30 * 60_000;
// Teto geral por dia (todos os viajantes): passou, o motor monta sozinho até virar o dia.
const MAX_DIA = Number(process.env.GEMINI_ROTEIRO_MAX_DIA) || 300;
let dia = { data: "", n: 0 };

const usos = new Map<number, number[]>();
const cache = new Map<string, { em: number; r: Promise<LugarIA[] | null> }>();

export const geminiDisponivel = () => !!process.env.GEMINI_API_KEY?.trim();

function liberado(userId: number) {
  const agora = Date.now(), hoje = new Date().toISOString().slice(0, 10);
  if (dia.data !== hoje) dia = { data: hoje, n: 0 };
  if (dia.n >= MAX_DIA) return false;
  const l = (usos.get(userId) ?? []).filter((t) => agora - t < JANELA);
  if (l.length >= MAX_POR_JANELA) return false;
  l.push(agora);
  usos.set(userId, l);
  dia.n++;
  return true;
}

const chave = (p: PedidoRoteiro) =>
  [p.userId, p.dest.id, p.inicio, p.fim, p.hotel.lat.toFixed(3), p.hotel.lng.toFixed(3), JSON.stringify(p.profile)].join("|");

function distKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

export const normNome = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function prompt(p: PedidoRoteiro) {
  const prof = p.profile;
  const catalogo = p.catalogo.filter((x) => !x.meal).slice(0, 150).map((x) => ({ id: x.id, nome: x.nome, cat: x.cat }));
  return `Você é um agente de viagens brasileiro montando um roteiro real. Use SEMPRE a busca do Google para confirmar cada lugar: se existe, se está aberto no período, horário de funcionamento nessas datas, se precisa comprar ingresso ou agendar antes e a faixa de preço.
Destino: ${p.dest.nome}, ${p.dest.pais}. Datas: ${p.inicio} a ${p.fim} (${p.nDias} ${p.nDias === 1 ? "dia" : "dias"}). Hospedagem: ${p.hotel.nome} (${p.hotel.lat.toFixed(4)}, ${p.hotel.lng.toFixed(4)}).
Viajantes: ${prof.comp}. Interesses: ${prof.int.join(", ") || "variados"}. Ritmo: ${prof.ritmo} (até ${p.porDia} atividades por dia). Orçamento: ${prof.orc}. Locomoção e horários: ${prof.mob.join(", ") || "sem preferência"}.${prof.evitar.length ? " Evitar: " + prof.evitar.join(", ") + "." : ""}
Lugares que já temos no catálogo (quando escolher um deles, use o id): ${JSON.stringify(catalogo)}
Escolha os lugares para preencher os ${p.nDias} dias, sem dia vazio, com o que um viajante com esse perfil não pode deixar de ver. Pode e deve incluir lugares fora do catálogo. Agrupe por região em cada dia. Parque temático ou passeio de dia inteiro ocupa o dia (dur 480 a 660). Inclua 1 restaurante perto das atividades de cada dia (meal true).
Responda só JSON: {"lugares":[{"id":null,"nome":"","cat":"${POI_CATS.join("|")}","bairro":"","lat":0,"lng":0,"dur":60,"abre":"09:00","fecha":"18:00","fechadoDias":[],"preco":0,"reserva":false,"indoor":false,"meal":false,"dia":1,"dica":""}]}
nome: o nome do lugar como um guia brasileiro escreveria (nome próprio no original, parte genérica do próprio nome em português, ex.: "Lake Eola Park" vira "Parque Lake Eola"); nunca acrescente a categoria antes do nome ("Magic Kingdom", não "Parque Temático Magic Kingdom"; "Yak & Yeti", não "Restaurante Yak & Yeti"). lat e lng do próprio lugar. abre e fecha no formato 24 h, nas datas da viagem. fechadoDias: dias da semana em que fecha (0 = domingo). preco 0 grátis a 3 caro. reserva true se precisa comprar ou agendar antes. dica: só quando reserva for true, 1 frase curta (onde comprar ou agendar); senão "". Sem texto extra. Nunca invente lugar: só o que você confirmou na busca.`;
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const min = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));

/** Confere campo a campo o que voltou: lugar fora da região, categoria desconhecida ou id estranho ficam de fora. */
export function lerLugares(texto: string, p: Pick<PedidoRoteiro, "dest" | "nDias" | "catalogo">): LugarIA[] {
  const a = texto.indexOf("{"), b = texto.lastIndexOf("}");
  if (a < 0 || b <= a) return [];
  let j: { lugares?: Record<string, unknown>[] };
  try { j = JSON.parse(texto.slice(a, b + 1)); } catch { return []; }
  const ids = new Set(p.catalogo.map((x) => x.id));
  const out: LugarIA[] = [];
  // No máximo ~8 lugares por dia: segura o catálogo se alguém tentar fazer a IA inventar uma lista enorme.
  for (const x of Array.isArray(j.lugares) ? j.lugares.slice(0, p.nDias * 8 + 4) : []) {
    const nome = typeof x.nome === "string" ? x.nome.trim().slice(0, 120) : "";
    const lat = Number(x.lat), lng = Number(x.lng);
    if (!nome || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (distKm(p.dest, { lat, lng }) > 80) continue;
    const meal = x.meal === true;
    const cat = POI_CATS.includes(String(x.cat)) ? String(x.cat) : meal ? "Restaurante" : "Atração";
    const id = ids.has(Number(x.id)) ? Number(x.id) : null;
    const abre = HORA.test(String(x.abre)) ? String(x.abre) : "09:00";
    const fecha = HORA.test(String(x.fecha)) ? String(x.fecha) : "18:00";
    let dur = Math.min(720, Math.max(20, Math.round(Number(x.dur) || 60)));
    // Passeio longo cabe entre a chegada (por volta das 10h15) e o fechamento; senão o motor tira do dia.
    if (dur >= 240) dur = Math.max(180, Math.min(dur, min(fecha) - Math.max(min(abre), 615)));
    out.push({
      id, nome, cat, meal, lat, lng, abre, fecha,
      bairro: typeof x.bairro === "string" ? x.bairro.trim().slice(0, 80) : "",
      dur,
      fechadoDias: Array.isArray(x.fechadoDias) ? [...new Set(x.fechadoDias.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))] : [],
      preco: Math.min(3, Math.max(0, Math.round(Number(x.preco) || 0))),
      reserva: x.reserva === true,
      indoor: x.indoor === true,
      dia: Math.min(p.nDias, Math.max(1, Math.round(Number(x.dia) || 1))),
      dica: typeof x.dica === "string" ? x.dica.trim().slice(0, 240) : "",
    });
  }
  return out;
}

async function chamar(p: PedidoRoteiro): Promise<LugarIA[] | null> {
  const modelo = process.env.GEMINI_ROTEIRO_MODEL?.trim() || "gemini-flash-latest";
  const t0 = Date.now();
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY!.trim(), "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt(p) }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.3, responseMimeType: "application/json", maxOutputTokens: 32_000 },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const r = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { totalTokenCount?: number; thoughtsTokenCount?: number };
    };
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${r.error?.message ?? ""}`.slice(0, 300));
    const texto = (r.candidates?.[0]?.content?.parts ?? []).map((x) => x.text ?? "").join("");
    const lugares = lerLugares(texto, p);
    // Uso para medir o custo real por roteiro.
    console.log(`[ia-roteiro] ${p.dest.nome} ${p.nDias}d: ${lugares.length} lugares em ${Math.round((Date.now() - t0) / 1000)} s, consumo ${r.usageMetadata?.totalTokenCount ?? "?"}`);
    return lugares.filter((l) => !l.meal).length ? lugares : null;
  } catch (e) {
    console.error("[ia-roteiro]", (e as Error).message.slice(0, 300));
    return null;
  }
}

/**
 * Pesquisa os lugares do roteiro. A mesma viagem (viajante, destino, datas, hospedagem e perfil) reaproveita
 * a pesquisa por 30 min: a prévia e a montagem não pagam duas vezes, e quem chega antes espera a mesma resposta.
 */
export function pesquisarRoteiro(p: PedidoRoteiro): Promise<LugarIA[] | null> {
  if (!geminiDisponivel()) return Promise.resolve(null);
  const k = chave(p), agora = Date.now();
  for (const [c, v] of cache) if (agora - v.em > CACHE_MS) cache.delete(c);
  const hit = cache.get(k);
  if (hit) return hit.r;
  if (!liberado(p.userId)) return Promise.resolve(null);
  const r = chamar(p);
  cache.set(k, { em: agora, r });
  // Falhou: não guarda, para a próxima tentativa pesquisar de novo.
  r.then((x) => { if (!x) cache.delete(k); });
  return r;
}

export type Plano = { pois: Poi[]; dias: Record<number, number[]> };

/**
 * Leva a pesquisa para o catálogo: lugar com id ou com o mesmo nome a menos de 1,5 km usa o que já existe
 * (o horário pesquisado substitui o estimado só nesta montagem); o resto entra como novo, ativo e não revisado,
 * para a equipe conferir no painel. Devolve os lugares (para o motor) e os ids de cada dia (índice a partir de 0).
 */
export async function aplicarPesquisa(dest: Destination, catalogo: Poi[], lugares: LugarIA[]): Promise<Plano> {
  const porId = new Map(catalogo.map((x) => [x.id, x]));
  const existentes = await sql<{ id: number; nome: string; lat: number; lng: number; active: boolean }[]>`
    SELECT id, nome, lat, lng, active FROM pois WHERE destination_id = ${dest.id}`;
  const pois = new Map<number, Poi>();
  const dias: Record<number, number[]> = {};
  for (const l of lugares) {
    let poi = l.id != null ? porId.get(l.id) : undefined;
    if (!poi) {
      const n = normNome(l.nome);
      const igual = existentes.find((e) => normNome(e.nome) === n && distKm(e, l) < 1.5);
      // Desativado pela equipe: respeita e deixa de fora.
      if (igual && !igual.active) continue;
      if (igual) poi = porId.get(igual.id);
      if (!poi && igual) continue; // existe, mas o motor não usa (revisão vencida): não duplica
    }
    if (poi) {
      if (poi.horarioEstimado && !poi.revisado)
        poi = { ...poi, abre: l.abre, fecha: l.fecha, closedDays: l.fechadoDias, reserva: poi.reserva || l.reserva, tip: poi.tip ?? (l.dica || null) };
    } else {
      const [r] = await sql<Parameters<typeof mapPoi>[0][]>`
        INSERT INTO pois (destination_id, nome, cat, bairro, lat, lng, dur, abre, fecha, preco, reserva, indoor, meal, tags,
                          closed_days, tip, source, active, revisado, horario_estimado)
        VALUES (${dest.id}, ${l.nome}, ${l.cat}, ${l.bairro}, ${l.lat}, ${l.lng}, ${l.dur}, ${l.abre}, ${l.fecha}, ${l.preco},
                ${l.reserva}, ${l.indoor}, ${l.meal}, ${[] as string[]}, ${l.fechadoDias}, ${l.dica || null}, 'Gemini', true, false, false)
        RETURNING *`;
      poi = mapPoi(r);
      existentes.push({ id: poi.id, nome: poi.nome, lat: poi.lat, lng: poi.lng, active: true });
    }
    if (pois.has(poi.id)) continue;
    pois.set(poi.id, poi);
    (dias[l.dia - 1] ??= []).push(poi.id);
  }
  return { pois: [...pois.values()], dias };
}
