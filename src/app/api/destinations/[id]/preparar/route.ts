import { after } from "next/server";
import { apiTraveler, fail, ok } from "@/lib/api";
import { ensureSchema, sql } from "@/lib/db";
import { agendarAtualizacoes, estadoImportacao, pedirImportacao, processarFila } from "@/lib/importFila";

// Destino do catálogo sem lugares: o app da nova viagem pede a importação (POST) e
// acompanha o andamento (GET) enquanto o viajante preenche datas e hospedagem.

// Limite por viajante para ninguém enfileirar o catálogo inteiro.
const JANELA = 30 * 60_000, MAX_POR_JANELA = 4;
const pedidos = new Map<number, number[]>();
function liberado(userId: number) {
  const agora = Date.now();
  if (pedidos.size > 5000) for (const [k, v] of pedidos) if (v.every((t) => agora - t >= JANELA)) pedidos.delete(k);
  const l = (pedidos.get(userId) ?? []).filter((t) => agora - t < JANELA);
  if (l.length >= MAX_POR_JANELA) return false;
  l.push(agora);
  pedidos.set(userId, l);
  return true;
}

// Ranking dos mais escolhidos (painel): conta uma escolha por viajante e destino a cada hora.
const escolhas = new Map<string, number>();
async function contarEscolha(userId: number, destId: number) {
  const k = userId + ":" + destId, agora = Date.now();
  if (agora - (escolhas.get(k) ?? 0) < 60 * 60_000) return;
  if (escolhas.size > 20000) for (const [c, t] of escolhas) if (agora - t >= 60 * 60_000) escolhas.delete(c);
  escolhas.set(k, agora);
  await sql`UPDATE destinations SET escolhas = escolhas + 1 WHERE id = ${destId}`;
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  if (!(await apiTraveler())) return fail("Entre de novo para continuar.", 401);
  await ensureSchema();
  const id = Number((await ctx.params).id);
  const e = Number.isInteger(id) && id > 0 ? await estadoImportacao(id) : null;
  return e ? ok(e) : fail("Destino não encontrado.", 404);
}

export async function POST(_req: Request, ctx: Ctx) {
  const u = await apiTraveler();
  if (!u) return fail("Entre de novo para continuar.", 401);
  await ensureSchema();
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return fail("Destino não encontrado.", 404);
  const antes = await estadoImportacao(id);
  if (!antes) return fail("Destino não encontrado.", 404);
  await contarEscolha(u.id, id);
  if (antes.status === "pronto" || antes.status === "poucos") {
    // importação automática velha: atualiza em segundo plano (o viajante segue com o que já tem)
    if (await agendarAtualizacoes(1, id)) after(() => processarFila());
    return ok(antes);
  }
  if (antes.status === "fila" || antes.status === "importando") {
    const e = antes.status === "fila" ? await pedirImportacao(id) : antes; // sobe para a frente da pré-carga
    after(() => processarFila());
    return ok(e);
  }
  if (!liberado(u.id)) return fail("Você já pediu vários destinos novos agora. Tente de novo em alguns minutos.", 429);
  const e = await pedirImportacao(id);
  after(() => processarFila());
  return ok(e);
}
