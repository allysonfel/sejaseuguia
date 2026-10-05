import { fail, isEmail, ok, readBody, str } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { ensureSchema, sql } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { parseProfile } from "@/lib/profileInput";
import type { Profile } from "@/lib/types";

export async function POST(req: Request) {
  const b = await readBody<{ nome: string; email: string; pass: string; consent: boolean; profile?: Profile }>(req);
  const nome = str(b.nome, 80);
  const email = str(b.email, 200).toLowerCase();
  const pass = typeof b.pass === "string" ? b.pass : "";
  if (!nome) return fail("Conte como quer ser chamado.");
  if (!isEmail(email)) return fail("Esse e-mail não parece válido.");
  if (pass.length < 8) return fail("A senha precisa ter pelo menos 8 caracteres.");
  if (b.consent !== true) return fail("Para montar roteiros precisamos do seu consentimento de uso dos dados.");
  // O quiz do cadastro já manda o perfil pronto; sem ele, o viajante preenche depois.
  const profile = b.profile ? parseProfile(b.profile) : null;
  if (profile && !profile.int.length) return fail("Escolha ao menos uma cena que combine com você.");
  await ensureSchema();
  const exists = await sql`SELECT 1 FROM users WHERE lower(email) = ${email}`;
  if (exists.length) return fail("Já existe uma conta com esse e-mail. Tente entrar ou recuperar a senha.");
  const [{ id }] = await sql<{ id: number }[]>`
    INSERT INTO users (kind, nome, email, pass_hash, profile, consent_at, last_seen_at)
    VALUES ('traveler', ${nome}, ${email}, ${hashPassword(pass)}, ${profile ? sql.json(profile) : null}, now(), now()) RETURNING id`;
  await startSession(id, "traveler");
  return ok({ redirect: profile ? "/app/nova-viagem" : "/app/perfil-viajante?primeiro=1" });
}
