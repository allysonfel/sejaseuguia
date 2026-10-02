import { apiStaff, fail, ok } from "@/lib/api";
import { sql } from "@/lib/db";
import { exportUserData } from "@/lib/export";

type Req = { id: number; user_id: number | null; kind: "export" | "delete"; status: string };

async function load(ctx: { params: Promise<{ id: string }> }) {
  const [r] = await sql<Req[]>`SELECT id, user_id, kind, status FROM privacy_requests WHERE id = ${Number((await ctx.params).id)}`;
  return r ?? null;
}

// Exportação: baixa o JSON com os dados do titular e marca o pedido como concluído.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await apiStaff("team"))) return fail("Sem acesso.", 403);
  const r = await load(ctx);
  if (!r || !r.user_id) return fail("Pedido não encontrado ou titular já excluído.", 404);
  const data = await exportUserData(r.user_id);
  await sql`UPDATE privacy_requests SET status = 'Concluído', done_at = now() WHERE id = ${r.id} AND kind = 'export'`;
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="dados-titular-${r.user_id}.json"` },
  });
}

// Exclusão: apaga a conta e tudo o que depende dela (viagens, notas, descobertas).
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await apiStaff("team"))) return fail("Sem acesso.", 403);
  const r = await load(ctx);
  if (!r) return fail("Pedido não encontrado.", 404);
  if (r.status !== "Pendente") return fail("Esse pedido já foi atendido.");
  if (r.kind === "delete" && r.user_id) await sql`DELETE FROM users WHERE id = ${r.user_id} AND kind = 'traveler'`;
  await sql`UPDATE privacy_requests SET status = 'Concluído', done_at = now() WHERE id = ${r.id}`;
  return ok();
}
