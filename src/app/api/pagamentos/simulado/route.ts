import { apiTraveler, fail, ok, readBody } from "@/lib/api";
import { sql } from "@/lib/db";
import { processarAviso, provedor } from "@/lib/pagamentos";
import { simulado } from "@/lib/pagamentos/simulado";

// Só no ambiente local: aprova, reembolsa ou dá chargeback num pedido do próprio viajante.
export async function POST(req: Request) {
  let p;
  try { p = provedor(); } catch { return fail("Indisponível.", 404); }
  if (p.nome !== "simulado") return fail("Indisponível.", 404);
  const u = await apiTraveler();
  if (!u) return fail("Entre de novo para continuar.", 401);
  const b = await readBody<{ ref: string; acao: string }>(req);
  const [dono] = await sql`SELECT 1 FROM pedidos WHERE ref = ${String(b.ref)} AND user_id = ${u.id}`;
  if (!dono) return fail("Pedido não encontrado.", 404);
  const ev = simulado.lerAviso({ ...b, id: Date.now() });
  if (!ev) return fail("Ação inválida.");
  return ok({ resultado: await processarAviso("simulado", ev) });
}
