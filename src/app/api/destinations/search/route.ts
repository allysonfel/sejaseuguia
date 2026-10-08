import { apiTraveler, fail, ok } from "@/lib/api";
import { normBusca } from "@/lib/busca";
import { mapDest, type DestRow } from "@/lib/data";
import { MIN_ROTEIRO } from "@/lib/importFila";
import { ensureSchema, sql } from "@/lib/db";
import type { DestinoBusca, Regiao } from "@/lib/types";

// Busca de destinos da nova viagem.
//   ?q=texto   → países/estados e cidades cujo nome (ou país/estado) bate com o texto
//   ?regiao=PT ou ?regiao=BR-PE → cidades daquele país ou estado
// Ordem: começa com o texto, já tem lugares, ranking dos mais visitados, população.
type Row = DestRow & { pronto: boolean };
const toHit = (r: Row): DestinoBusca => ({ ...mapDest(r), pronto: r.pronto, importStatus: (r.import_status as DestinoBusca["importStatus"]) ?? null });

export async function GET(req: Request) {
  if (!(await apiTraveler())) return fail("Entre de novo para continuar.", 401);
  await ensureSchema();
  const p = new URL(req.url).searchParams;
  // pronto = já dá para montar roteiro (mesmo mínimo da criação da viagem)
  const pronto = sql`((SELECT count(*) FROM pois x WHERE x.destination_id = d.id AND x.active) >= ${MIN_ROTEIRO})`;

  const regiao = (p.get("regiao") ?? "").toUpperCase();
  if (regiao) {
    if (!/^[A-Z]{2}(-[A-Z]{2})?$/.test(regiao)) return fail("Região inválida.");
    const [pais, uf] = regiao.split("-");
    const rows = await sql<Row[]>`
      SELECT d.*, ${pronto} AS pronto FROM destinations d
      WHERE d.pais_iso = ${pais} ${uf ? sql`AND d.uf = ${uf}` : sql``}
      ORDER BY pronto DESC, d.ranking NULLS LAST, d.populacao DESC NULLS LAST, d.nome LIMIT 80`;
    return ok({ regioes: [], cidades: rows.map(toHit) });
  }

  const q = normBusca(p.get("q"));
  if (q.length < 2) return ok({ regioes: [], cidades: [] });
  // casa no começo de qualquer palavra ("rio" acha Rio Branco, não "Balneário")
  const comeca = q + "%", palavra = "% " + q + "%";
  const [regioes, cidades] = await Promise.all([
    sql<Regiao[]>`
      SELECT r.iso, r.tipo, r.nome, r.pais, c.n AS cidades FROM regioes r
      CROSS JOIN LATERAL (
        SELECT count(*)::int AS n FROM destinations d
        WHERE d.pais_iso = split_part(r.iso, '-', 1) AND (r.tipo = 'pais' OR d.uf = split_part(r.iso, '-', 2))
      ) c
      WHERE (r.busca LIKE ${comeca} OR r.busca LIKE ${palavra}) AND c.n > 0
      ORDER BY (r.busca LIKE ${comeca}) DESC, r.tipo DESC, r.nome LIMIT 4`,
    sql<Row[]>`
      SELECT d.*, ${pronto} AS pronto FROM destinations d
      WHERE (d.busca LIKE ${comeca} OR d.busca LIKE ${palavra})
      ORDER BY (d.busca LIKE ${comeca}) DESC, pronto DESC, d.ranking NULLS LAST, d.populacao DESC NULLS LAST, d.nome LIMIT 10`,
  ]);
  return ok({ regioes, cidades: cidades.map(toHit) });
}
