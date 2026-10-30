import "server-only";
import { ensureSchema, sql } from "./db";
import { HORAS_ANTES, LISTA_RECURSOS, RECURSOS_DA_VIAGEM, type Recurso } from "./planosPadrao";

// Cobrança: o que cada viagem tem liberado. Montar o roteiro e vê-lo no app é sempre grátis;
// PDF, mapa, Modo viagem, assistente com IA e foto dependem do plano comprado para a viagem.
// COBRANCA_ATIVA desligada (padrão): tudo liberado, como antes da cobrança existir.

export const cobrancaAtiva = () => process.env.COBRANCA_ATIVA === "1";

export type Produto = {
  id: string; nome: string; descricao: string; tipo: "avulso" | "assinatura";
  precoCentavos: number; recursos: Recurso[]; creditosMes: number; ofertaCakto: string | null; ativo: boolean;
};
type ProdutoRow = { id: string; nome: string; descricao: string; tipo: "avulso" | "assinatura"; preco_centavos: string; recursos: string[]; creditos_mes: number; oferta_cakto: string | null; ativo: boolean };
const recursosValidos = (l: string[]) => l.filter((r): r is Recurso => (LISTA_RECURSOS as string[]).includes(r));
const mapProduto = (r: ProdutoRow): Produto => ({
  id: r.id, nome: r.nome, descricao: r.descricao, tipo: r.tipo, precoCentavos: Number(r.preco_centavos),
  recursos: recursosValidos(r.recursos), creditosMes: r.creditos_mes, ofertaCakto: r.oferta_cakto, ativo: r.ativo,
});

export async function listarProdutos(soAtivos = true): Promise<Produto[]> {
  await ensureSchema();
  const r = await sql<ProdutoRow[]>`
    SELECT id, nome, descricao, tipo, preco_centavos, recursos, creditos_mes, oferta_cakto, ativo FROM produtos
    WHERE ${soAtivos ? sql`ativo` : sql`true`} ORDER BY ordem, id`;
  return r.map(mapProduto);
}

export async function getProduto(id: string): Promise<Produto | null> {
  await ensureSchema();
  const [r] = await sql<ProdutoRow[]>`SELECT id, nome, descricao, tipo, preco_centavos, recursos, creditos_mes, oferta_cakto, ativo FROM produtos WHERE id = ${id}`;
  return r ? mapProduto(r) : null;
}

/** Janela das funções online: de 48 h antes do 1º dia até o fim do último dia (horário de Brasília, com folga). */
export function janelaDaViagem(inicio: string, fim: string) {
  const abre = new Date(`${inicio}T00:00:00-03:00`).getTime() - HORAS_ANTES * 3600_000;
  const fecha = new Date(`${fim}T23:59:59-03:00`).getTime() + 12 * 3600_000;
  return { abre, fecha, agora: Date.now() >= abre && Date.now() <= fecha };
}

export type Acesso = {
  cobranca: boolean;
  /** Recursos comprados para a viagem (independe da data). */
  comprados: Recurso[];
  /** Recursos que funcionam agora (os da viagem só dentro da janela). */
  liberados: Recurso[];
  /** Data/hora (ms) em que as funções online passam a valer. */
  abre: number;
};

export async function acessoDaViagem(trip: { id: number; inicio: string; fim: string }): Promise<Acesso> {
  const j = janelaDaViagem(trip.inicio, trip.fim);
  if (!cobrancaAtiva()) return { cobranca: false, comprados: [...LISTA_RECURSOS], liberados: [...LISTA_RECURSOS], abre: j.abre };
  await ensureSchema();
  const r = await sql<{ recursos: string[] }[]>`
    SELECT l.recursos FROM liberacoes l JOIN pedidos p ON p.id = l.pedido_id
    WHERE l.trip_id = ${trip.id} AND p.status = 'pago'`;
  const comprados = recursosValidos([...new Set(r.flatMap((x) => x.recursos))]);
  const liberados = comprados.filter((x) => !RECURSOS_DA_VIAGEM.includes(x) || j.agora);
  return { cobranca: true, comprados, liberados, abre: j.abre };
}

/**
 * Funções que não são de uma viagem só (O que é?, Explorar, assistente com IA): valem se alguma viagem
 * da pessoa (dela ou em que foi convidada) tem o recurso e está dentro da janela agora.
 */
export async function podeUsarAgora(userId: number, recurso: Recurso): Promise<boolean> {
  if (!cobrancaAtiva()) return true;
  await ensureSchema();
  const viagens = await sql<{ id: number; inicio: string; fim: string }[]>`
    SELECT DISTINCT t.id, t.inicio::text AS inicio, t.fim::text AS fim
    FROM trips t JOIN liberacoes l ON l.trip_id = t.id JOIN pedidos p ON p.id = l.pedido_id
    WHERE p.status = 'pago' AND ${recurso} = ANY (l.recursos)
      AND (t.owner_id = ${userId} OR EXISTS (SELECT 1 FROM trip_members m JOIN users u ON lower(u.email) = lower(m.email)
                                              WHERE m.trip_id = t.id AND u.id = ${userId}))`;
  return viagens.some((v) => !RECURSOS_DA_VIAGEM.includes(recurso) || janelaDaViagem(v.inicio, v.fim).agora);
}

export type AssinaturaAtiva = { id: number; pedidoId: number; produto: Produto; validaAte: string; creditosRestantes: number };

/** Assinatura ativa da pessoa, com os créditos que sobram no mês corrente (janela de 30 dias). */
export async function assinaturaAtiva(userId: number): Promise<AssinaturaAtiva | null> {
  if (!cobrancaAtiva()) return null;
  await ensureSchema();
  const [a] = await sql<{ id: number; pedido_id: number; produto_id: string; valida_ate: Date }[]>`
    SELECT a.id, a.pedido_id, a.produto_id, a.valida_ate FROM assinaturas a JOIN pedidos p ON p.id = a.pedido_id
    -- Cancelada continua valendo até o fim do período pago; reembolso tira o pedido de "pago".
    WHERE a.user_id = ${userId} AND a.status IN ('ativa', 'cancelada') AND a.valida_ate > now() AND p.status = 'pago'
    ORDER BY a.valida_ate DESC LIMIT 1`;
  if (!a) return null;
  const produto = await getProduto(a.produto_id);
  if (!produto) return null;
  const [{ n }] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM liberacoes WHERE pedido_id = ${a.pedido_id} AND created_at > now() - interval '30 days'`;
  return { id: a.id, pedidoId: a.pedido_id, produto, validaAte: a.valida_ate.toISOString(), creditosRestantes: Math.max(0, produto.creditosMes - n) };
}

/**
 * Dentro do app da App Store e do Google Play não aparece link para pagar fora da loja
 * (as duas lojas recusam o app). O app marca o user agent com "SejaSeuGuiaApp" (capacitor.config.ts).
 */
export const compraNoAparelho = (h: Headers) => !/SejaSeuGuiaApp/.test(h.get("user-agent") ?? "");
