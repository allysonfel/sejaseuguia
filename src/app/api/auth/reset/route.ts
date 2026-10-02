import { createHash } from "node:crypto";
import { fail, ok, readBody } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { ensureSchema, sql } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export async function POST(req: Request) {
  const b = await readBody<{ token: string; pass: string }>(req);
  const pass = typeof b.pass === "string" ? b.pass : "";
  if (typeof b.token !== "string" || !b.token) return fail("Link inválido.");
  if (pass.length < 8) return fail("A senha precisa ter pelo menos 8 caracteres.");
  await ensureSchema();
  const hash = createHash("sha256").update(b.token).digest("hex");
  const rows = await sql<{ user_id: number; kind: "traveler" | "staff" }[]>`
    DELETE FROM password_resets r USING users u
    WHERE r.token_hash = ${hash} AND r.expires_at > now() AND u.id = r.user_id
    RETURNING r.user_id, u.kind`;
  if (!rows[0]) return fail("Esse link expirou ou já foi usado. Peça um novo.");
  await sql`UPDATE users SET pass_hash = ${hashPassword(pass)} WHERE id = ${rows[0].user_id}`;
  await startSession(rows[0].user_id, rows[0].kind);
  return ok({ redirect: rows[0].kind === "staff" ? "/admin" : "/app" });
}
