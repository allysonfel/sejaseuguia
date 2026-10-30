import { apiTraveler, fail, ok } from "@/lib/api";
import { getTripForUser } from "@/lib/data";
import { acessoDaViagem, assinaturaAtiva, compraNoAparelho, listarProdutos } from "@/lib/planos";

// Planos à venda e o que a viagem já tem (tela de escolher plano).
export async function GET(req: Request) {
  const u = await apiTraveler();
  if (!u) return fail("Entre de novo para continuar.", 401);
  const tripId = Number(new URL(req.url).searchParams.get("viagem"));
  const trip = Number.isInteger(tripId) && tripId > 0 ? await getTripForUser(tripId, u) : null;
  const [produtos, assinatura, acesso] = await Promise.all([listarProdutos(), assinaturaAtiva(u.id), trip ? acessoDaViagem(trip) : null]);
  return ok({
    // Só o que a tela mostra (a oferta da Cakto fica no servidor).
    produtos: produtos.map((p) => ({ id: p.id, nome: p.nome, descricao: p.descricao, tipo: p.tipo, precoCentavos: p.precoCentavos, recursos: p.recursos, creditosMes: p.creditosMes })),
    assinatura: assinatura && { nome: assinatura.produto.nome, validaAte: assinatura.validaAte, creditosRestantes: assinatura.creditosRestantes, recursos: assinatura.produto.recursos },
    acesso,
    podeComprar: compraNoAparelho(req.headers),
  });
}
