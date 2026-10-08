import { apiStaff, fail, ok, readBody } from "@/lib/api";
import { sql } from "@/lib/db";
import { norm } from "@/lib/placeImport";
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
      reviewed_at = now(), revisado = true, horario_estimado = false
    WHERE id = ${id} RETURNING id`;
  if (!r.length) return fail("Lugar não encontrado.", 404);
  return ok();
}

// Ações rápidas da tabela: marcar como revisado, ativar ou desativar.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await apiStaff("pois"))) return fail("Sem acesso.", 403);
  const id = Number((await ctx.params).id);
  const b = await readBody<{ review: boolean; active: boolean }>(req);
  if (b.review) await sql`UPDATE pois SET reviewed_at = now(), revisado = true WHERE id = ${id}`;
  if (typeof b.active === "boolean") await sql`UPDATE pois SET active = ${b.active} WHERE id = ${id}`;
  return ok();
}

// Descartar um lugar importado que não serve (fechado, repetido, não se visita).
// Lugar que já entrou em algum roteiro só pode ser desativado, para não quebrar a viagem.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await apiStaff("pois"))) return fail("Sem acesso.", 403);
  const id = Number((await ctx.params).id);
  const [p] = await sql<{ destination_id: number; nome: string; source: string }[]>`SELECT destination_id, nome, source FROM pois WHERE id = ${id}`;
  if (!p) return fail("Lugar não encontrado.", 404);
  if (p.source === "Curadoria") return fail("Lugares da curadoria não são descartados: desative em vez disso.");
  const used = await sql`
    SELECT 1 FROM trips t, jsonb_array_elements(t.days) d, jsonb_array_elements(d->'items') i
    WHERE t.destination_id = ${p.destination_id} AND (i->>'p')::int = ${id} LIMIT 1`;
  if (used.length) return fail("Esse lugar já está no roteiro de alguém. Desative em vez de descartar.");
  await sql.begin(async (tx) => {
    await tx`DELETE FROM pois WHERE id = ${id}`;
    await tx`INSERT INTO import_skips (destination_id, nome) VALUES (${p.destination_id}, ${norm(p.nome)}) ON CONFLICT DO NOTHING`;
  });
  return ok();
}
