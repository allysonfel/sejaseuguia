import { apiStaff, fail, ok } from "@/lib/api";
import { sql } from "@/lib/db";

// Marca como revisados todos os lugares importados automaticamente de um destino (tira a etiqueta do viajante).
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await apiStaff("pois"))) return fail("Sem acesso.", 403);
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return fail("Destino não encontrado.", 404);
  const r = await sql`
    UPDATE pois SET revisado = true, reviewed_at = now(), pendente_ia = NULL
    WHERE destination_id = ${id} AND NOT revisado RETURNING id`;
  return ok({ n: r.length });
}
