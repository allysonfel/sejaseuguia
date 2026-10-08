import { apiStaff, fail, ok, readBody } from "@/lib/api";
import { sql } from "@/lib/db";

// Liberar (ou tirar) vários lugares de uma vez, depois da revisão. Liberar conta como revisão.
export async function PATCH(req: Request) {
  if (!(await apiStaff("pois"))) return fail("Sem acesso.", 403);
  const b = await readBody<{ ids: number[]; active: boolean }>(req);
  const ids = Array.isArray(b.ids) ? b.ids.map(Number).filter(Number.isInteger).slice(0, 500) : [];
  if (!ids.length || typeof b.active !== "boolean") return fail("Nada para atualizar.");
  await sql`UPDATE pois SET active = ${b.active}, reviewed_at = CASE WHEN ${b.active} THEN now() ELSE reviewed_at END,
    revisado = revisado OR ${b.active} WHERE id = ANY(${ids})`;
  return ok({ n: ids.length });
}
