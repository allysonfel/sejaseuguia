import { CATALOGO_VERSAO, CIDADES, ESTADOS, PAISES } from "./catalogo";
import { normBusca } from "./busca";
import { sql } from "./db";

// Aplica o catálogo (src/lib/catalogo.ts) no banco, uma vez por versão:
// - regioes: países e estados do Brasil;
// - destinations: cidade nova entra sem lugares (aparece na busca, roteiro só depois da importação);
//   cidade que já existe (mesmo nome a até 40 km) só ganha os dados do catálogo, sem perder o que a equipe editou.

const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = Math.PI / 180, x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r), y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
};

export async function aplicarCatalogo() {
  const [v] = await sql<{ value: number }[]>`SELECT value FROM settings WHERE key = 'catalogo_versao'`;
  if (Number(v?.value) < CATALOGO_VERSAO || !v) {
    const paisDe = new Map(PAISES.map((p) => [p.iso, p]));

    await sql.begin(async (tx) => {
      for (const p of PAISES)
        await tx`
          INSERT INTO regioes (iso, tipo, nome, pais, lat, lng, busca) VALUES (${p.iso}, 'pais', ${p.nome}, ${p.nome}, ${p.lat}, ${p.lng}, ${normBusca(p.nome, ...(p.apelidos ?? []))})
          ON CONFLICT (iso) DO UPDATE SET nome = excluded.nome, pais = excluded.pais, lat = excluded.lat, lng = excluded.lng, busca = excluded.busca`;
      for (const e of ESTADOS)
        await tx`
          INSERT INTO regioes (iso, tipo, nome, pais, lat, lng, busca) VALUES (${"BR-" + e.uf}, 'estado', ${e.nome}, 'Brasil', ${e.lat}, ${e.lng}, ${normBusca(e.nome, e.uf)})
          ON CONFLICT (iso) DO UPDATE SET nome = excluded.nome, lat = excluded.lat, lng = excluded.lng, busca = excluded.busca`;

      const atuais = await tx<{ id: number; nome: string; lat: number; lng: number; wikidata: string | null }[]>`SELECT id, nome, lat, lng, wikidata FROM destinations`;
      for (const c of CIDADES) {
        const pais = paisDe.get(c.iso)!;
        // o estado fica fora: ele aparece como linha própria na busca (senão "rio" traria Porto Alegre)
        const busca = normBusca(c.nome, c.alias, pais.nome, ...(pais.apelidos ?? []));
        const igual = atuais.find((d) => d.wikidata === c.q) ?? atuais.find((d) => !d.wikidata && normBusca(d.nome) === normBusca(c.nome) && km(d, c) <= 40);
        if (igual) {
          await tx`
            UPDATE destinations SET wikidata = ${c.q}, pais_iso = ${c.iso}, uf = ${c.uf ?? null}, populacao = ${c.pop ?? null}, ranking = ${c.rank ?? null},
              busca = ${normBusca(igual.nome, c.alias, pais.nome, ...(pais.apelidos ?? []))},
              foto_url = coalesce(foto_url, ${c.foto ?? null}), foto_credito = CASE WHEN foto_url IS NULL THEN ${c.credito ?? null} ELSE foto_credito END
            WHERE id = ${igual.id}`;
        } else {
          await tx`
            INSERT INTO destinations (nome, pais, lat, lng, moeda, wikidata, pais_iso, uf, populacao, ranking, busca, foto_url, foto_credito, foto_buscada_em)
            VALUES (${c.nome}, ${pais.nome}, ${c.lat}, ${c.lng}, ${pais.moeda}, ${c.q}, ${c.iso}, ${c.uf ?? null}, ${c.pop ?? null}, ${c.rank ?? null},
                    ${busca}, ${c.foto ?? null}, ${c.credito ?? null}, ${c.foto ? new Date() : null})`;
        }
      }
      await tx`INSERT INTO settings (key, value) VALUES ('catalogo_versao', ${tx.json(CATALOGO_VERSAO)}) ON CONFLICT (key) DO UPDATE SET value = excluded.value`;
    });
    console.log(`[catalogo] versão ${CATALOGO_VERSAO}: ${PAISES.length} países, ${ESTADOS.length} estados, ${CIDADES.length} cidades`);
  }

  // Destinos criados pela equipe fora do catálogo também precisam do texto de busca.
  const sem = await sql<{ id: number; nome: string; pais: string }[]>`SELECT id, nome, pais FROM destinations WHERE busca IS NULL`;
  for (const d of sem) await sql`UPDATE destinations SET busca = ${normBusca(d.nome, d.pais)} WHERE id = ${d.id}`;
}
