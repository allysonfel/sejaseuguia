import { fail, isEmail, ok, readBody, str } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { ensureSchema, sql } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export async function POST(req: Request) {
  const b = await readBody<{ nome: string; email: string; pass: string; consent: boolean }>(req);
  const nome = str(b.nome, 80);
  const email = str(b.email, 200).toLowerCase();
  const pass = typeof b.pass === "string" ? b.pass : "";
  if (!nome) return fail("Conte como quer ser chamado.");
  if (!isEmail(email)) return fail("Esse e-mail não parece válido.");
  if (pass.length < 8) return fail("A senha precisa ter pelo menos 8 caracteres.");
  if (b.consent !== true) return fail("Para montar roteiros precisamos do seu consentimento de uso dos dados.");
  await ensureSchema();
  const exists = await sql`SELECT 1 FROM users WHERE lower(email) = ${email}`;
  if (exists.length) return fail("Já existe uma conta com esse e-mail. Tente entrar ou recuperar a senha.");
  const [{ id }] = await sql<{ id: number }[]>`
    INSERT INTO users (kind, nome, email, pass_hash, consent_at, last_seen_at)
    VALUES ('traveler', ${nome}, ${email}, ${hashPassword(pass)}, now(), now()) RETURNING id`;
  await startSession(id, "traveler");
  return ok({ redirect: "/app/perfil-viajante?primeiro=1" });
}
