import { apiStaff, fail, ok, readBody } from "@/lib/api";
import { parseDest } from "@/lib/destInput";
import { sql } from "@/lib/db";
import { buscarFotoDestino } from "@/lib/destFoto";

export async function POST(req: Request) {
  if (!(await apiStaff("dest"))) return fail("Sem acesso.", 403);
  const d = parseDest((await readBody<Record<string, unknown>>(req)) as Record<string, unknown>);
  if (typeof d === "string") return fail(d);
  // Sem foto escolhida pela equipe, busca uma no Wikimedia Commons.
  const f = d.fotoUrl ? { url: d.fotoUrl, credito: d.fotoCredito } : await buscarFotoDestino(d.nome, d.lat, d.lng);
  const [{ id }] = await sql<{ id: number }[]>`
    INSERT INTO destinations (nome, pais, lat, lng, moeda, update_freq, cor1, cor2, foto_url, foto_credito, foto_buscada_em)
    VALUES (${d.nome}, ${d.pais}, ${d.lat}, ${d.lng}, ${d.moeda}, ${d.updateFreq}, ${d.cor1}, ${d.cor2}, ${f?.url ?? null}, ${f?.credito ?? null}, now())
    RETURNING id`;
  return ok({ id });
}
