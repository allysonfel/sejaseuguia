import { fail, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { listPois } from "@/lib/data";

// Lugares que o motor pode usar num destino (para contar o que fica perto do hotel).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return fail("Entre de novo para continuar.", 401);
  const { id } = await ctx.params;
  const pois = await listPois(Number(id), { forEngine: true });
  return ok({ pois });
}
