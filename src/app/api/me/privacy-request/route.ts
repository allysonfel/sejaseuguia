import { apiTraveler, fail, ok, readBody } from "@/lib/api";
import { sql } from "@/lib/db";

// Pedido de exclusão de conta: a equipe atende no painel (Equipe e LGPD).
export async function POST(req: Request) {
  const u = await apiTraveler();
  if (!u) return fail("Entre de novo para continuar.", 401);
  const kind = (await readBody<{ kind: string }>(req)).kind === "export" ? "export" : "delete";
  const pending = await sql`SELECT 1 FROM privacy_requests WHERE user_id = ${u.id} AND kind = ${kind} AND status = 'Pendente'`;
  if (!pending.length)
    await sql`INSERT INTO privacy_requests (user_id, user_nome, user_email, kind) VALUES (${u.id}, ${u.nome}, ${u.email}, ${kind})`;
  return ok();
}
