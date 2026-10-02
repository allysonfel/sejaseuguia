import { apiTraveler, fail, ok, readBody, str } from "@/lib/api";
import { ensureSchema, sql } from "@/lib/db";

// Destino que alguém tentou planejar e ainda não existe na base (vira sugestão no painel).
export async function POST(req: Request) {
  const u = await apiTraveler();
  if (!u) return fail("Entre de novo para continuar.", 401);
  const termo = str((await readBody<{ termo: string }>(req)).termo, 80);
  if (termo.length < 2) return fail("Informe o destino.");
  await ensureSchema();
  await sql`INSERT INTO destination_requests (termo, user_id) VALUES (${termo}, ${u.id})`;
  return ok();
}
