import { apiTraveler, fail, isEmail, ok, readBody, str } from "@/lib/api";
import { getTripForUser, listMembers, logActivity } from "@/lib/data";
import { sql } from "@/lib/db";
import { appUrl, sendMail } from "@/lib/mail";

// Convida alguém para a viagem pelo e-mail. Quem entrar (ou criar conta)
// com esse e-mail passa a ver a viagem na tela inicial.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await apiTraveler();
  if (!u) return fail("Entre de novo para continuar.", 401);
  const trip = await getTripForUser(Number((await ctx.params).id), u);
  if (!trip) return fail("Viagem não encontrada.", 404);
  if (trip.access !== "owner") return fail("Só quem organiza a viagem pode convidar.", 403);
  const b = await readBody<{ email: string; role: string }>(req);
  const email = str(b.email, 200).toLowerCase();
  if (!isEmail(email)) return fail("Esse e-mail não parece válido.");
  if (email === u.email.toLowerCase()) return fail("Você já organiza esta viagem.");
  const role = b.role === "viewer" ? "viewer" : "editor";
  await sql`
    INSERT INTO trip_members (trip_id, email, role) VALUES (${trip.id}, ${email}, ${role})
    ON CONFLICT (trip_id, email) DO UPDATE SET role = EXCLUDED.role`;
  await logActivity(trip.id, u.id, "Convidou " + email);
  await sendMail(
    email,
    u.nome + " convidou você para a viagem a " + trip.destino,
    `${u.nome} montou um roteiro para ${trip.destino} no Seja Seu Guia e convidou você para ${role === "editor" ? "ver e editar" : "acompanhar"}.\n\nEntre ou crie sua conta com este e-mail: ${appUrl()}/entrar?cadastro=1`,
  );
  return ok({ members: await listMembers(trip.id) });
}
