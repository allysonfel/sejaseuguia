import { fail, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { buscarFotoLugar } from "@/lib/destFoto";

// Foto de um lugar para a prévia "Confira as atrações". Busca no Wikidata/Commons
// só na primeira vez e guarda; sem foto, tenta de novo depois de 30 dias.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return fail("Entre de novo para continuar.", 401);
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return fail("Lugar inválido.", 400);
  const [p] = await sql<{ nome: string; nome_original: string | null; lat: number; lng: number; foto_url: string | null; foto_credito: string | null; buscar: boolean }[]>`
    SELECT nome, nome_original, lat, lng, foto_url, foto_credito,
      (foto_url IS NULL AND (foto_buscada_em IS NULL OR foto_buscada_em < now() - interval '30 days')) AS buscar
    FROM pois WHERE id = ${id} AND active`;
  if (!p) return fail("Lugar não encontrado.", 404);
  if (!p.buscar) return ok({ url: p.foto_url, credito: p.foto_credito });
  // Nome original (dos dados abertos) acha mais que o traduzido; se não achar, tenta o traduzido.
  const f = (p.nome_original && (await buscarFotoLugar(p.nome_original, p.lat, p.lng))) || (await buscarFotoLugar(p.nome, p.lat, p.lng));
  await sql`UPDATE pois SET foto_buscada_em = now(), foto_url = ${f?.url ?? null}, foto_credito = ${f?.credito ?? null} WHERE id = ${id}`;
  return ok({ url: f?.url ?? null, credito: f?.credito ?? null });
}
