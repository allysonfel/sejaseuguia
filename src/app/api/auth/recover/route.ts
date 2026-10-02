import { createHash } from "node:crypto";
import { fail, ok, readBody, str } from "@/lib/api";
import { ensureSchema, sql } from "@/lib/db";
import { appUrl, sendMail } from "@/lib/mail";
import { randomToken } from "@/lib/password";

// Sempre responde igual, exista ou não a conta (não revela quem é cliente).
export async function POST(req: Request) {
  const b = await readBody<{ email: string }>(req);
  const email = str(b.email, 200).toLowerCase();
  if (!email) return fail("Informe o e-mail.");
  await ensureSchema();
  const rows = await sql<{ id: number; nome: string }[]>`SELECT id, nome FROM users WHERE lower(email) = ${email}`;
  if (rows[0]) {
    const token = randomToken();
    const hash = createHash("sha256").update(token).digest("hex");
    await sql`DELETE FROM password_resets WHERE user_id = ${rows[0].id}`;
    await sql`INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (${hash}, ${rows[0].id}, now() + interval '1 hour')`;
    await sendMail(
      email,
      "Crie uma senha nova no Seja Seu Guia",
      `Oi, ${rows[0].nome}.\n\nPara criar uma senha nova, abra o link abaixo (vale por 1 hora):\n${appUrl()}/redefinir-senha?token=${token}\n\nSe não foi você que pediu, pode ignorar este e-mail.`,
    );
  }
  return ok();
}
