import { ok } from "@/lib/api";
import { processarAviso } from "@/lib/pagamentos";
import { cakto } from "@/lib/pagamentos/cakto";

// Webhook da Cakto: confere o segredo antes de tudo; aviso repetido não conta de novo.
export async function POST(req: Request) {
  const corpo = await req.json().catch(() => null);
  const ev = cakto.lerAviso(corpo);
  if (!ev) return Response.json({ error: "Aviso inválido." }, { status: 401 });
  try {
    return ok({ resultado: await processarAviso("cakto", ev) });
  } catch (e) {
    console.error("[pagamentos] falha ao tratar aviso da Cakto:", (e as Error).message);
    // 500 faz a Cakto mandar de novo (a transação voltou, o aviso não ficou marcado como tratado).
    return Response.json({ error: "Falha ao tratar o aviso." }, { status: 500 });
  }
}
