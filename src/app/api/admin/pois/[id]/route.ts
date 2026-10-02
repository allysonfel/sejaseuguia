import { apiStaff, fail, ok, readBody } from "@/lib/api";
import { sql } from "@/lib/db";
import { parsePoi } from "@/lib/poiInput";

// Salvar um lugar conta como revisão: volta para as sugestões se estava desatualizado.
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await apiStaff("pois"))) return fail("Sem acesso.", 403);
  const id = Number((await ctx.params).id);
  const p = parsePoi((await readBody<Record<string, unknown>>(req)) as Record<string, unknown>);
  if (typeof p === "string") return fail(p);
  const r = await sql`
    UPDATE pois SET nome = ${p.nome}, cat = ${p.cat}, bairro = ${p.bairro}, lat = ${p.lat}, lng = ${p.lng}, dur = ${p.dur},
      abre = ${p.abre}, fecha = ${p.fecha}, preco = ${p.preco}, reserva = ${p.reserva}, indoor = ${p.indoor}, meal = ${p.meal},
      tags = ${p.tags}, closed_days = ${p.closedDays}, tip = ${p.tip}, historia = ${p.historia},
      curiosidades = ${sql.json(p.curiosidades)}, datas = ${sql.json(p.datas)}, source = ${p.source}, active = ${p.active},
      reviewed_at = now()
    WHERE id = ${id} RETURNING id`;
  if (!r.length) return fail("Lugar não encontrado.", 404);
  return ok();
}

// Ações rápidas da tabela: marcar como revisado, ativar ou desativar.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await apiStaff("pois"))) return fail("Sem acesso.", 403);
  const id = Number((await ctx.params).id);
  const b = await readBody<{ review: boolean; active: boolean }>(req);
  if (b.review) await sql`UPDATE pois SET reviewed_at = now() WHERE id = ${id}`;
  if (typeof b.active === "boolean") await sql`UPDATE pois SET active = ${b.active} WHERE id = ${id}`;
  return ok();
}
