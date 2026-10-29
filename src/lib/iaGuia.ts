// Guia do destino para o roteiro em PDF: o Gemini pesquisa no Google o que o viajante precisa saber
// (sobre o destino, dinheiro, transporte, apps, alertas, pratos típicos, preço de cada lugar do roteiro,
// onde reservar e dicas). Uma pesquisa por viagem, guardada em trips.guia; roda por trás depois da montagem
// e, se ainda não existir, na hora de baixar o PDF. Sem chave ou com falha, o PDF sai só com o que o app já tem.

import { sql } from "./db";
import { geminiDisponivel, chamarGemini, cotaGeral } from "./iaRoteiro";
import type { Poi, Profile, Trip } from "./types";

export type Guia = {
  sobre: string[];
  clima: string;
  dinheiro: string[];
  transporte: string[];
  apps: { nome: string; para: string }[];
  alertas: string[];
  pratos: { nome: string; tipo: "prato" | "doce" | "bebida"; desc: string }[];
  /** preço por pessoa na moeda local, por lugar do roteiro (id); null = grátis ou sem preço confirmado */
  precos: Record<number, { valor: number | null; obs: string }>;
  /** onde reservar os lugares que pedem reserva (id) */
  reservas: Record<number, { como: string; site: string | null }>;
  /** gasto médio por pessoa por dia, na moeda local */
  diaria: { alimentacao: number | null; transporte: number | null };
  dicas: string[];
};

const emAndamento = new Map<number, Promise<Guia | null>>();
// Guias por organizador em 24 h (cada viagem criada pede um): segura quem cria viagens em série.
const JANELA = 24 * 60 * 60_000, MAX_POR_JANELA = 20;
const usos = new Map<number, number[]>();

function liberado(ownerId: number) {
  const agora = Date.now();
  const l = (usos.get(ownerId) ?? []).filter((t) => agora - t < JANELA);
  if (l.length >= MAX_POR_JANELA || !cotaGeral()) return false;
  l.push(agora);
  usos.set(ownerId, l);
  return true;
}

const txt = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const lista = (v: unknown, n: number, max: number) => (Array.isArray(v) ? v.map((x) => txt(x, max)).filter(Boolean).slice(0, n) : []);
const valor = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n < 1_000_000 ? Math.round(n * 100) / 100 : null;
};
// Link só https, sem usuário e senha embutidos: o PDF mostra como texto clicável.
function site(v: unknown): string | null {
  const s = txt(v, 300);
  try {
    const u = new URL(s);
    return u.protocol === "https:" && !u.username && !u.password ? u.toString() : null;
  } catch {
    return null;
  }
}

function prompt(trip: Trip, pois: Poi[], profile: Profile) {
  const lugares = pois.map((p) => ({ id: p.id, nome: p.nome, cat: p.cat, reserva: p.reserva }));
  return `Você é um agente de viagens brasileiro preparando o guia em PDF de um roteiro real. Use a busca do Google para confirmar preços, regras e links oficiais. Não invente: o que não confirmou, deixe vazio ou null.
Destino: ${trip.destino}, ${trip.pais}. Datas: ${trip.inicio} a ${trip.fim}. Moeda local: ${trip.moeda}. Viajantes: ${trip.pax} (${profile.comp}). Orçamento: ${profile.orc}.
Lugares do roteiro: ${JSON.stringify(lugares)}
Responda só JSON:
{"sobre":["até 3 parágrafos curtos sobre o destino"],"clima":"1 a 2 frases sobre o clima nessas datas e o que levar",
"dinheiro":["moeda, cartão ou dinheiro, gorjeta, câmbio"],"transporte":["como circular, bilhete, preço da passagem, aeroporto até o centro"],
"apps":[{"nome":"","para":""}],"alertas":["golpes comuns, dias em que museus fecham, documentos ou visto para brasileiros"],
"pratos":[{"nome":"","tipo":"prato|doce|bebida","desc":"1 frase"}],
"precos":[{"id":0,"valor":0,"obs":""}],"reservas":[{"id":0,"como":"","site":""}],
"diaria":{"alimentacao":0,"transporte":0},"dicas":["lembranças, fotos, horários, segurança"]}
Regras: até 5 itens em cada lista (pratos até 8). precos: um item por lugar do roteiro, valor = ingresso por adulto na moeda local (número) ou null se grátis ou sem preço confirmado; obs curta (ex.: "grátis", "crianças pagam menos", "ingresso por horário"). reservas: só para os lugares com reserva true, como comprar ou agendar e o site oficial (https). diaria: gasto médio por pessoa por dia com alimentação e com transporte local, na moeda local. Escreva em português do Brasil com acentuação correta (é, ã, ç, ô): nunca tire os acentos. Sem travessão, sem emojis.`;
}

export function lerGuia(texto: string, pois: Poi[]): Guia | null {
  const a = texto.indexOf("{"), b = texto.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  let j: Record<string, unknown>;
  try { j = JSON.parse(texto.slice(a, b + 1)); } catch { return null; }
  const ids = new Set(pois.map((p) => p.id));
  const precos: Guia["precos"] = {}, reservas: Guia["reservas"] = {};
  for (const x of Array.isArray(j.precos) ? (j.precos as Record<string, unknown>[]).slice(0, 200) : []) {
    const id = Number(x?.id);
    if (ids.has(id)) precos[id] = { valor: valor(x.valor), obs: txt(x.obs, 80) };
  }
  for (const x of Array.isArray(j.reservas) ? (j.reservas as Record<string, unknown>[]).slice(0, 100) : []) {
    const id = Number(x?.id);
    if (ids.has(id)) reservas[id] = { como: txt(x.como, 240), site: site(x.site) };
  }
  const d = (j.diaria ?? {}) as Record<string, unknown>;
  const g: Guia = {
    sobre: lista(j.sobre, 3, 900),
    clima: txt(j.clima, 400),
    dinheiro: lista(j.dinheiro, 5, 300),
    transporte: lista(j.transporte, 5, 300),
    apps: (Array.isArray(j.apps) ? (j.apps as Record<string, unknown>[]) : []).map((x) => ({ nome: txt(x?.nome, 60), para: txt(x?.para, 160) })).filter((x) => x.nome).slice(0, 5),
    alertas: lista(j.alertas, 5, 300),
    pratos: (Array.isArray(j.pratos) ? (j.pratos as Record<string, unknown>[]) : [])
      .map((x) => ({ nome: txt(x?.nome, 80), tipo: (["prato", "doce", "bebida"].includes(String(x?.tipo)) ? x.tipo : "prato") as Guia["pratos"][number]["tipo"], desc: txt(x?.desc, 200) }))
      .filter((x) => x.nome).slice(0, 8),
    precos, reservas,
    diaria: { alimentacao: valor(d.alimentacao), transporte: valor(d.transporte) },
    dicas: lista(j.dicas, 5, 300),
  };
  return g.sobre.length || Object.keys(precos).length ? g : null;
}

async function pesquisar(trip: Trip, pois: Poi[], profile: Profile): Promise<Guia | null> {
  const t0 = Date.now();
  try {
    const r = await chamarGemini(prompt(trip, pois, profile));
    const g = lerGuia(r.texto, pois);
    console.log(`[ia-guia] ${trip.destino} viagem ${trip.id}: ${g ? "ok" : "vazio"} em ${Math.round((Date.now() - t0) / 1000)} s, consumo ${r.consumo ?? "?"}`);
    if (g) await sql`UPDATE trips SET guia = ${sql.json(g)}, guia_em = now() WHERE id = ${trip.id}`;
    return g;
  } catch (e) {
    console.error("[ia-guia]", (e as Error).message.slice(0, 300));
    return null;
  }
}

/** Guia guardado da viagem (null se ainda não tem). */
export async function guiaSalvo(tripId: number): Promise<Guia | null> {
  const [r] = await sql<{ guia: Guia | null }[]>`SELECT guia FROM trips WHERE id = ${tripId}`;
  return r?.guia ?? null;
}

/**
 * Guia da viagem: o guardado, ou uma pesquisa nova (uma por viagem de cada vez; quem chega durante a pesquisa espera a mesma).
 * Só os lugares do roteiro que não são refeição entram no preço; os restaurantes também, para a gastronomia.
 */
export async function obterGuia(trip: Trip, pois: Poi[], profile: Profile): Promise<Guia | null> {
  const salvo = await guiaSalvo(trip.id);
  if (salvo) return salvo;
  if (!geminiDisponivel()) return null;
  const atual = emAndamento.get(trip.id);
  if (atual) return atual;
  if (!liberado(trip.ownerId)) return null;
  const r = pesquisar(trip, pois, profile).finally(() => emAndamento.delete(trip.id));
  emAndamento.set(trip.id, r);
  return r;
}
