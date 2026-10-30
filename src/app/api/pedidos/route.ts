import { apiTraveler, fail, ok, readBody, str } from "@/lib/api";
import { getTripForUser } from "@/lib/data";
import { criarPedido } from "@/lib/pagamentos";
import { assinaturaAtiva, cobrancaAtiva, compraNoAparelho, getProduto } from "@/lib/planos";

// Começa uma compra: cria o pedido e devolve o endereço do checkout. Plano avulso é sempre de uma viagem.
export async function POST(req: Request) {
  const u = await apiTraveler();
  if (!u) return fail("Entre de novo para continuar.", 401);
  if (!cobrancaAtiva()) return fail("As compras ainda não estão abertas.");
  if (!compraNoAparelho(req.headers)) return fail("Compras indisponíveis no app por enquanto.", 403);
  const b = await readBody<{ produto: string; viagem?: number }>(req);
  const produto = await getProduto(str(b.produto, 60));
  if (!produto?.ativo) return fail("Plano não encontrado.");
  let tripId: number | null = null;
  if (produto.tipo === "avulso") {
    const trip = await getTripForUser(Number(b.viagem), u);
    if (!trip) return fail("Viagem não encontrada.", 404);
    if (trip.access === "viewer") return fail("Quem só pode ver a viagem não compra plano para ela.", 403);
    tripId = trip.id;
  } else if (await assinaturaAtiva(u.id)) {
    return fail("Você já tem uma assinatura ativa.");
  }
  try {
    return ok({ url: await criarPedido(u, produto, tripId) });
  } catch (e) {
    console.error("[pedidos]", (e as Error).message);
    return fail("Não deu para abrir o pagamento agora. Tente de novo em instantes.", 502);
  }
}
