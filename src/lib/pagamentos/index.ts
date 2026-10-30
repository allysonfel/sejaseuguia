import "server-only";
import { randomBytes } from "node:crypto";
import type postgres from "postgres";
import { ensureSchema, sql } from "../db";
import { appUrl } from "../mail";
import type { Produto } from "../planos";
import { cakto } from "./cakto";
import { simulado } from "./simulado";
import type { EventoPagamento, Provedor } from "./tipos";

// Camada única de pagamento. PAGAMENTOS_PROVEDOR escolhe o provedor ("cakto" ou "simulado");
// o simulado só roda com o app no endereço local (nunca no Railway).

export function provedor(): Provedor {
  const nome = process.env.PAGAMENTOS_PROVEDOR?.trim() || "cakto";
  if (nome === "simulado") {
    if (!/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(appUrl())) throw new Error("Pagamento simulado só roda no ambiente local.");
    return simulado;
  }
  return cakto;
}

/** Cria o pedido (aguardando pagamento) e devolve o endereço do checkout. */
export async function criarPedido(u: { id: number; nome: string; email: string }, produto: Produto, tripId: number | null) {
  await ensureSchema();
  const p = provedor();
  const ref = randomBytes(18).toString("base64url");
  await sql`
    INSERT INTO pedidos (ref, user_id, trip_id, produto_id, valor_centavos, provedor)
    VALUES (${ref}, ${u.id}, ${tripId}, ${produto.id}, ${produto.precoCentavos}, ${p.nome})`;
  return p.urlCheckout({ ref, valorCentavos: produto.precoCentavos, produtoNome: produto.nome, ofertaCakto: produto.ofertaCakto, email: u.email, nome: u.nome });
}

type PedidoRow = { id: number; user_id: number | null; trip_id: number | null; produto_id: string; valor_centavos: string; status: string };

/**
 * Trata um aviso do provedor. Idempotente: o mesmo aviso (idEvento) só conta uma vez.
 * Não confia no valor do aviso: compara com o pedido; pago a menos fica "revisar" para a equipe.
 */
export async function processarAviso(prov: Provedor["nome"], ev: EventoPagamento): Promise<string> {
  await ensureSchema();
  if (ev.tipo === "ignorar") return "ignorado";
  // Tudo numa transação só: se algo falhar, o aviso não fica marcado como tratado e o provedor manda de novo.
  return sql.begin(async (tx) => {
    const novo = await tx`
      INSERT INTO pagamento_eventos (provedor, id_evento, tipo) VALUES (${prov}, ${ev.idEvento}, ${ev.tipo})
      ON CONFLICT DO NOTHING RETURNING 1`;
    if (!novo.length) return "repetido";
    // Acha o pedido: pela ref do link; senão pelo id do provedor; senão pela assinatura.
    const [pedido] = ev.ref
      ? await tx<PedidoRow[]>`SELECT id, user_id, trip_id, produto_id, valor_centavos, status FROM pedidos WHERE ref = ${ev.ref} AND provedor = ${prov} FOR UPDATE`
      : ev.idExterno
        ? await tx<PedidoRow[]>`SELECT id, user_id, trip_id, produto_id, valor_centavos, status FROM pedidos WHERE id_externo = ${ev.idExterno} AND provedor = ${prov} FOR UPDATE`
        : ev.assinaturaExterna
          ? await tx<PedidoRow[]>`SELECT id, user_id, trip_id, produto_id, valor_centavos, status FROM pedidos WHERE assinatura_externa = ${ev.assinaturaExterna} AND provedor = ${prov} ORDER BY id LIMIT 1 FOR UPDATE`
          : [];
    // Sem ref (link aberto direto, sem os parâmetros): o pedido aguardando mais recente do mesmo e-mail, de até 7 dias.
    const [porEmail] = !pedido && ev.tipo === "pago" && ev.email
      ? await tx<PedidoRow[]>`
          SELECT p.id, p.user_id, p.trip_id, p.produto_id, p.valor_centavos, p.status FROM pedidos p JOIN users u ON u.id = p.user_id
          WHERE lower(u.email) = ${ev.email} AND p.status = 'aguardando' AND p.provedor = ${prov} AND p.created_at > now() - interval '7 days'
          ORDER BY p.created_at DESC LIMIT 1 FOR UPDATE OF p`
      : [];
    const alvo = pedido ?? porEmail;
    if (!alvo) {
      console.error(`[pagamentos] aviso ${ev.tipo} sem pedido (${prov}, ${ev.idEvento})`);
      return "sem pedido";
    }
    return aplicar(tx, alvo, ev);
  });
}

async function aplicar(tx: postgres.TransactionSql, pedido: PedidoRow, ev: EventoPagamento): Promise<string> {
  if (ev.tipo === "pago") {
    if (pedido.status === "pago") return "já pago";
    const esperado = Number(pedido.valor_centavos);
    const pago = ev.valorCentavos ?? esperado;
    const status = pago < Math.round(esperado * 0.95) ? "revisar" : "pago";
    await tx`
      UPDATE pedidos SET status = ${status}, pago_centavos = ${pago}, pago_em = now(), atualizado_em = now(),
        id_externo = coalesce(id_externo, ${ev.idExterno}), assinatura_externa = coalesce(assinatura_externa, ${ev.assinaturaExterna}),
        metodo = ${ev.metodo}
      WHERE id = ${pedido.id}`;
    if (status === "revisar") {
      console.error(`[pagamentos] pedido ${pedido.id} pago a menos (${pago} de ${esperado} centavos): ficou para revisão`);
      return "revisar";
    }
    const [prod] = await tx<{ tipo: string; recursos: string[] }[]>`SELECT tipo, recursos FROM produtos WHERE id = ${pedido.produto_id}`;
    if (prod?.tipo === "assinatura" && pedido.user_id) {
      await tx`
        INSERT INTO assinaturas (user_id, pedido_id, produto_id, valida_ate)
        VALUES (${pedido.user_id}, ${pedido.id}, ${pedido.produto_id}, now() + interval '1 year')
        ON CONFLICT (pedido_id) DO NOTHING`;
    }
    if (prod?.tipo === "avulso" && pedido.trip_id) {
      await tx`
        INSERT INTO liberacoes (trip_id, pedido_id, recursos) VALUES (${pedido.trip_id}, ${pedido.id}, ${prod.recursos})
        ON CONFLICT DO NOTHING`;
    }
    return "pago";
  }

  if (ev.tipo === "reembolsado" || ev.tipo === "chargeback") {
    // A liberação some sozinha: só vale pedido com status "pago".
    await tx`UPDATE pedidos SET status = ${ev.tipo}, atualizado_em = now() WHERE id = ${pedido.id}`;
    await tx`UPDATE assinaturas SET status = 'cancelada' WHERE pedido_id = ${pedido.id}`;
    return ev.tipo;
  }

  if (ev.tipo === "assinatura_renovada") {
    await tx`UPDATE assinaturas SET status = 'ativa', valida_ate = greatest(valida_ate, now()) + interval '1 year' WHERE pedido_id = ${pedido.id}`;
    return "renovada";
  }

  await tx`UPDATE assinaturas SET status = 'cancelada' WHERE pedido_id = ${pedido.id}`;
  return "assinatura cancelada";
}
