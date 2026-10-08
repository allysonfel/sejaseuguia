import { apiStaff, fail, ok, readBody } from "@/lib/api";
import { sql } from "@/lib/db";
import { parseDest } from "@/lib/destInput";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await apiStaff("dest"))) return fail("Sem acesso.", 403);
  const id = Number((await ctx.params).id);
  const d = parseDest((await readBody<Record<string, unknown>>(req)) as Record<string, unknown>);
  if (typeof d === "string") return fail(d);
  const r = await sql`
    UPDATE destinations SET nome = ${d.nome}, pais = ${d.pais}, lat = ${d.lat}, lng = ${d.lng}, moeda = ${d.moeda},
      update_freq = ${d.updateFreq}, cor1 = ${d.cor1}, cor2 = ${d.cor2}, foto_url = ${d.fotoUrl}, foto_credito = ${d.fotoCredito}
    WHERE id = ${id} RETURNING id`;
  if (!r.length) return fail("Destino não encontrado.", 404);
  return ok();
}
