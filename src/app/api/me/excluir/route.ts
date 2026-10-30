import { apiTraveler, fail, ok, readBody } from "@/lib/api";
import { endSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ipDe } from "@/lib/limiteRequisicoes";
import { appUrl } from "@/lib/mail";
import { verifyPassword } from "@/lib/password";
import { bloqueado, LIMITE_EMAIL, LIMITE_IP, limparFalhas, registrarFalha } from "@/lib/tentativas";

// Exclusão da conta pelo próprio viajante, na hora (App Store e Google Play exigem).
// Confirma a senha; apaga a conta e o que depende dela (viagens criadas, reservas, avaliações, descobertas).
// Fica só o registro de que a exclusão foi feita, com o e-mail mascarado.
export async function POST(req: Request) {
  // Ação destrutiva com cookie: só aceita pedido vindo do próprio app.
  const origem = req.headers.get("origin");
  if (origem && ![req.headers.get("host"), new URL(appUrl()).host].includes(new URL(origem).host)) return fail("Pedido de outro site.", 403);
  const u = await apiTraveler();
  if (!u) return fail("Entre de novo para continuar.", 401);
  const pass = (await readBody<{ pass: string }>(req)).pass;
  if (typeof pass !== "string" || !pass) return fail("Digite a sua senha para confirmar.");
  const chaveEmail = `email:${u.email.toLowerCase()}`, chaveIp = `ip:${ipDe(req.headers)}`;
  if (await bloqueado([[chaveEmail, LIMITE_EMAIL], [chaveIp, LIMITE_IP]]))
    return fail("Muitas tentativas. Aguarde 15 minutos e tente de novo.", 429);
  const [r] = await sql<{ pass_hash: string }[]>`SELECT pass_hash FROM users WHERE id = ${u.id} AND kind = 'traveler'`;
  if (!r || !verifyPassword(pass, r.pass_hash)) {
    await registrarFalha(chaveEmail, chaveIp);
    return fail("Senha incorreta.", 401);
  }
  await limparFalhas(chaveEmail);
  const [usuario, dominio] = u.email.split("@");
  const mascarado = usuario.slice(0, 1) + "***@" + (dominio ?? "");
  await sql.begin(async (tx) => {
    await tx`INSERT INTO privacy_requests (user_id, user_nome, user_email, kind, status, done_at)
      VALUES (NULL, ${u.nome.split(" ")[0]}, ${mascarado}, 'delete', 'Concluído', now())`;
    // Pedidos antigos da própria conta (ficam como atendidos, sem o e-mail completo).
    await tx`UPDATE privacy_requests SET status = 'Concluído', done_at = coalesce(done_at, now()), user_email = ${mascarado}
      WHERE user_id = ${u.id}`;
    await tx`DELETE FROM users WHERE id = ${u.id} AND kind = 'traveler'`;
  });
  await endSession();
  return ok({ redirect: "/entrar?excluida=1" });
}
