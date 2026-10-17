import { fail, ok, readBody, str } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { ensureSchema, sql } from "@/lib/db";
import { ipDe } from "@/lib/limiteRequisicoes";
import { verifyPassword } from "@/lib/password";
import { bloqueado, LIMITE_EMAIL, LIMITE_IP, limparFalhas, registrarFalha } from "@/lib/tentativas";

export async function POST(req: Request) {
  const b = await readBody<{ email: string; pass: string; kind: string }>(req);
  const email = str(b.email, 200).toLowerCase();
  const pass = typeof b.pass === "string" ? b.pass : "";
  const kind = b.kind === "staff" ? "staff" : "traveler";
  if (!email || !pass) return fail("Informe e-mail e senha.");
  const chaveEmail = `email:${email}`, chaveIp = `ip:${ipDe(req.headers)}`;
  if (await bloqueado([[chaveEmail, LIMITE_EMAIL], [chaveIp, LIMITE_IP]]))
    return fail("Muitas tentativas. Aguarde 15 minutos ou recupere a senha.", 429);
  await ensureSchema();
  const rows = await sql<{ id: number; kind: string; pass_hash: string; profile: unknown }[]>`
    SELECT id, kind, pass_hash, profile FROM users WHERE lower(email) = ${email}`;
  const u = rows[0];
  if (!u || !verifyPassword(pass, u.pass_hash)) {
    await registrarFalha(chaveEmail, chaveIp);
    return fail("E-mail ou senha incorretos.", 401);
  }
  await limparFalhas(chaveEmail);
  if (u.kind !== kind)
    return fail(kind === "staff" ? "Essa conta é de viajante. Use a aba Viajante." : "Essa conta é da equipe. Use a aba Equipe.", 401);
  await startSession(u.id, kind);
  await sql`UPDATE users SET last_seen_at = now() WHERE id = ${u.id}`;
  return ok({ redirect: kind === "staff" ? "/admin" : u.profile ? "/app" : "/app/perfil-viajante?primeiro=1" });
}
