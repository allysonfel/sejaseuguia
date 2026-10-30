import { apiTraveler, fail, ok } from "@/lib/api";
import { getTripForUser } from "@/lib/data";
import { sql } from "@/lib/db";
import { assinaturaAtiva } from "@/lib/planos";

// Libera a viagem com 1 crédito da assinatura (as funções do plano da assinatura).
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await apiTraveler();
  if (!u) return fail("Entre de novo para continuar.", 401);
  const trip = await getTripForUser(Number((await ctx.params).id), u);
  if (!trip) return fail("Viagem não encontrada.", 404);
  if (trip.access === "viewer") return fail("Quem só pode ver a viagem não usa crédito nela.", 403);
  const a = await assinaturaAtiva(u.id);
  if (!a) return fail("Você não tem assinatura ativa.");
  if (a.creditosRestantes <= 0) return fail("Os créditos deste mês acabaram. Eles voltam em até 30 dias.");
  await sql`
    INSERT INTO liberacoes (trip_id, pedido_id, recursos) VALUES (${trip.id}, ${a.pedidoId}, ${a.produto.recursos})
    ON CONFLICT DO NOTHING`;
  return ok();
}
