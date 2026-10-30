import { apiStaff, fail, ok, readBody, str } from "@/lib/api";
import { sql } from "@/lib/db";
import { getProduto } from "@/lib/planos";

// Editar um plano à venda: só nome, preço, oferta da Cakto e ativo (o que cada plano libera fica no código).
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await apiStaff("sales"))) return fail("Sem acesso.", 403);
  const id = (await ctx.params).id;
  if (!(await getProduto(id))) return fail("Plano não encontrado.", 404);
  const b = await readBody<{ nome: string; precoCentavos: number; ofertaCakto: string; ativo: boolean }>(req);
  const nome = str(b.nome, 80);
  const preco = Math.round(Number(b.precoCentavos));
  const oferta = str(b.ofertaCakto, 80);
  if (!nome) return fail("Dê um nome ao plano.");
  if (!Number.isInteger(preco) || preco < 100 || preco > 10_000_000) return fail("O preço precisa ficar entre R$ 1,00 e R$ 100.000,00.");
  if (oferta && !/^[A-Za-z0-9_-]{3,80}$/.test(oferta)) return fail("O código da oferta da Cakto só tem letras, números, hífen e sublinhado.");
  await sql`UPDATE produtos SET nome = ${nome}, preco_centavos = ${preco}, oferta_cakto = ${oferta || null}, ativo = ${b.ativo === true} WHERE id = ${id}`;
  return ok({ produto: await getProduto(id) });
}
