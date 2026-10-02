import { apiStaff, fail, isEmail, ok, readBody, str } from "@/lib/api";
import { sql } from "@/lib/db";
import { appUrl, sendMail } from "@/lib/mail";
import { hashPassword, randomToken } from "@/lib/password";
import { STAFF_ROLES, type StaffRole } from "@/lib/types";

// Convida alguém da equipe: cria a conta com uma senha provisória, mostrada uma vez no painel.
export async function POST(req: Request) {
  const me = await apiStaff("team");
  if (!me) return fail("Sem acesso.", 403);
  const b = await readBody<{ nome: string; email: string; role: string }>(req);
  const nome = str(b.nome, 80), email = str(b.email, 200).toLowerCase();
  if (!nome) return fail("Informe o nome.");
  if (!isEmail(email)) return fail("E-mail inválido.");
  const role = STAFF_ROLES.includes(b.role as StaffRole) ? (b.role as StaffRole) : null;
  if (!role) return fail("Escolha o perfil.");
  if ((await sql`SELECT 1 FROM users WHERE lower(email) = ${email}`).length) return fail("Já existe uma conta com esse e-mail.");
  const tempPass = randomToken(8);
  await sql`
    INSERT INTO users (kind, nome, email, pass_hash, staff_role, consent_at)
    VALUES ('staff', ${nome}, ${email}, ${hashPassword(tempPass)}, ${role}, now())`;
  await sendMail(email, "Seu acesso ao painel do Seja Seu Guia",
    `Oi, ${nome}. ${me.nome} criou seu acesso ao painel (${role}).\n\nEntre em ${appUrl()}/entrar?equipe=1 com este e-mail e a senha provisória: ${tempPass}\nDepois, troque a senha em "Esqueci minha senha".`);
  return ok({ tempPass });
}
