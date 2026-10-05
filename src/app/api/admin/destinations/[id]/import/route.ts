import { apiStaff, fail, ok, readBody } from "@/lib/api";
import { getDestination } from "@/lib/data";
import { importDestination } from "@/lib/placeImport";

// Busca atrações e restaurantes do destino em dados abertos. Entram desativados para revisão.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await apiStaff("pois"))) return fail("Sem acesso.", 403);
  const dest = await getDestination(Number((await ctx.params).id));
  if (!dest) return fail("Destino não encontrado.", 404);
  const b = await readBody<{ raio: number }>(req);
  try {
    return ok(await importDestination(dest, Number(b.raio) || 8));
  } catch (e) {
    console.error("[import]", dest.nome, e);
    return fail("Os serviços de mapa não responderam agora. Tente de novo em alguns minutos.", 502);
  }
}
