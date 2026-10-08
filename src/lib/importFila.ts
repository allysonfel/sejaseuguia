import { getDestination } from "./data";
import { sql } from "./db";
import { importDestination, traduzirPendentes } from "./placeImport";
import type { ImportStatus } from "./types";

// Fila de importação automática de lugares (destino do catálogo que o viajante escolheu
// e ainda não tem lugares). Uma importação por vez em cada instância do app, com um respiro
// entre elas: o Wikidata e o Overpass são públicos e limitam quem pede muito.
// O estado fica no banco (destinations.import_status), então sobrevive a reinício:
// "importando" parado há mais de 10 min volta para a fila.
// Prioridade: viajante esperando (0) passa na frente da pré-carga do painel (1), que anda devagar.

const MIN_ATRACOES = 8;
/** Destino importado automaticamente há mais que isso é reimportado (lugares novos + horários reais). */
export const REIMPORTAR_DIAS = 90;
const RESPIRO = 3000, RESPIRO_PRECARGA = 15000;
const g = globalThis as unknown as { __ssgFila?: Promise<void> | null };
const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

export type EstadoImportacao = { status: ImportStatus | null; lugares: number; posicao: number };

export async function estadoImportacao(id: number): Promise<EstadoImportacao | null> {
  const [d] = await sql<{ import_status: ImportStatus | null; import_em: Date | null; import_prioridade: number; lugares: number }[]>`
    SELECT import_status, import_em, import_prioridade, (SELECT count(*)::int FROM pois p WHERE p.destination_id = d.id AND p.active) AS lugares
    FROM destinations d WHERE id = ${id}`;
  if (!d) return null;
  // tem lugar ativo = pronto (ou "poucos"); sem lugar, "pronto" antigo não vale (a equipe pode ter desativado tudo)
  const status: ImportStatus | null = d.lugares > 0
    ? (d.import_status === "importando" ? "importando" : d.import_status === "poucos" ? "poucos" : "pronto")
    : (d.import_status === "pronto" || d.import_status === "poucos" ? null : d.import_status);
  const [{ n }] = status === "fila"
    ? await sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM destinations WHERE import_status = 'importando'
          OR (import_status = 'fila' AND (import_prioridade < ${d.import_prioridade} OR (import_prioridade = ${d.import_prioridade} AND import_em < ${d.import_em})))`
    : [{ n: 0 }];
  return { status, lugares: d.lugares, posicao: n };
}

/** Põe o destino na fila se ele ainda não tem lugares (ou se a última tentativa falhou há mais de 10 min). */
export async function pedirImportacao(id: number): Promise<EstadoImportacao | null> {
  // já estava na pré-carga: o viajante esperando passa na frente
  await sql`UPDATE destinations SET import_prioridade = 0 WHERE id = ${id} AND import_status = 'fila'`;
  await sql`
    UPDATE destinations d SET import_status = 'fila', import_em = now(), import_erro = NULL, import_prioridade = 0
    WHERE id = ${id}
      AND NOT EXISTS (SELECT 1 FROM pois p WHERE p.destination_id = d.id AND p.active)
      AND (import_status IS NULL OR import_status IN ('pronto', 'poucos')
           OR (import_status = 'falhou' AND import_em < now() - interval '10 minutes'))`;
  return estadoImportacao(id);
}

/** Agenda a reimportação dos destinos automáticos importados há mais de REIMPORTAR_DIAS (prioridade baixa).
 *  Com id, só daquele destino (o viajante acabou de escolher). O destino continua pronto durante a atualização. */
export async function agendarAtualizacoes(limite: number, id?: number): Promise<number> {
  const rows = await sql`
    UPDATE destinations SET import_status = 'fila', import_prioridade = 1, import_em = now(), import_erro = NULL
    WHERE id IN (
      SELECT d.id FROM destinations d
      WHERE d.import_status IN ('pronto', 'poucos') AND d.import_em < now() - make_interval(days => ${REIMPORTAR_DIAS})
        AND EXISTS (SELECT 1 FROM pois p WHERE p.destination_id = d.id AND p.active AND NOT p.revisado)
        ${id ? sql`AND d.id = ${id}` : sql``}
      ORDER BY d.escolhas DESC, d.import_em LIMIT ${limite})
    RETURNING id`;
  return rows.length;
}

/** Processa a fila até esvaziar. Chamar de novo enquanto roda devolve a mesma execução. */
export function processarFila(): Promise<void> {
  if (g.__ssgFila) return g.__ssgFila;
  g.__ssgFila = (async () => {
    try {
      await sql`UPDATE destinations SET import_status = 'fila' WHERE import_status = 'importando' AND import_em < now() - interval '10 minutes'`;
      // reimportação periódica: a cada subida do app, alguns destinos com importação velha entram atrás de tudo
      await agendarAtualizacoes(5);
      // traduções que ficaram pela metade (IA fora do ar ou cota esgotada)
      for (const { destination_id } of await sql<{ destination_id: number }[]>`
        SELECT DISTINCT destination_id FROM pois WHERE pendente_ia IS NOT NULL AND active LIMIT 3`) {
        const d = await getDestination(destination_id);
        if (d) await traduzir(d);
      }
      for (;;) {
        // SKIP LOCKED: com mais de uma instância do app, cada destino é importado por uma só
        const [prox] = await sql<{ id: number; import_prioridade: number }[]>`
          UPDATE destinations SET import_status = 'importando', import_em = now()
          WHERE id = (SELECT id FROM destinations WHERE import_status = 'fila' ORDER BY import_prioridade, import_em LIMIT 1 FOR UPDATE SKIP LOCKED)
          RETURNING id, import_prioridade`;
        if (!prox) break;
        await importarUm(prox.id);
        await sleep(prox.import_prioridade > 0 ? RESPIRO_PRECARGA : RESPIRO);
      }
    } catch (e) {
      console.error("[fila]", (e as Error).message);
    } finally {
      g.__ssgFila = null;
    }
  })();
  return g.__ssgFila;
}

async function traduzir(dest: NonNullable<Awaited<ReturnType<typeof getDestination>>>) {
  try {
    const t0 = Date.now();
    const n = await traduzirPendentes(dest);
    if (n) console.log(`[fila] ${dest.nome}: ${n} lugares traduzidos pela IA em ${Math.round((Date.now() - t0) / 1000)} s`);
  } catch (e) {
    console.error(`[fila] ${dest.nome}: tradução falhou:`, (e as Error).message);
  }
}

async function importarUm(id: number) {
  const dest = await getDestination(id);
  if (!dest) return;
  const t0 = Date.now();
  try {
    const ativos = async () => (await sql<{ n: number; atracoes: number }[]>`
      SELECT count(*)::int AS n, (count(*) FILTER (WHERE NOT meal))::int AS atracoes FROM pois WHERE destination_id = ${id} AND active`)[0];
    const atualizacao = (await ativos()).n > 0; // já tinha lugares: é a reimportação periódica
    let r = await importDestination(dest, 8, { auto: true, atualizar: atualizacao });
    let c = await ativos();
    // cidade pequena: tenta de novo com raio maior (o que já entrou não se repete)
    if (c.atracoes < MIN_ATRACOES) {
      const r2 = await importDestination(dest, 15, { auto: true, atualizar: atualizacao });
      r = {
        atracoes: r.atracoes + r2.atracoes, restaurantes: r.restaurantes + r2.restaurantes, repetidos: r2.repetidos,
        avisos: [...r.avisos, ...r2.avisos], atualizados: (r.atualizados ?? 0) + (r2.atualizados ?? 0),
      };
      c = await ativos();
    }
    const n = c.n;
    const status: ImportStatus = n === 0 ? "falhou" : c.atracoes < MIN_ATRACOES ? "poucos" : "pronto";
    const erro = n === 0 ? "Nenhum lugar encontrado nos dados abertos." : r.avisos.join(" ") || null;
    await sql`UPDATE destinations SET import_status = ${status}, import_em = now(), import_erro = ${erro} WHERE id = ${id}`;
    console.log(`[fila] ${dest.nome}: ${status}, ${r.atracoes} atrações e ${r.restaurantes} restaurantes novos${atualizacao ? `, ${r.atualizados ?? 0} atualizados` : ""} em ${Math.round((Date.now() - t0) / 1000)} s`);
    // o viajante já pode montar o roteiro; nomes e histórias em português chegam logo depois
    if (n > 0) await traduzir(dest);
  } catch (e) {
    const msg = (e as Error).message.slice(0, 300);
    await sql`UPDATE destinations SET import_status = 'falhou', import_em = now(), import_erro = ${msg} WHERE id = ${id}`;
    console.error(`[fila] ${dest.nome} falhou:`, msg);
  }
}

// ------------------------------------------------------------ painel

export type ResumoFila = { semLugares: number; fila: number; precarga: number; importando: string | null; falhou: number; automaticos: number };

export async function resumoFila(): Promise<ResumoFila> {
  const [r] = await sql<ResumoFila[]>`
    SELECT
      count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM pois p WHERE p.destination_id = d.id AND p.active))::int AS "semLugares",
      count(*) FILTER (WHERE import_status = 'fila')::int AS fila,
      count(*) FILTER (WHERE import_status = 'fila' AND import_prioridade > 0)::int AS precarga,
      (SELECT nome FROM destinations WHERE import_status = 'importando' ORDER BY import_em LIMIT 1) AS importando,
      count(*) FILTER (WHERE import_status = 'falhou')::int AS falhou,
      (SELECT count(*)::int FROM pois WHERE active AND NOT revisado) AS automaticos
    FROM destinations d`;
  return r;
}

/** Põe na fila (devagar, atrás dos viajantes) todos os destinos do catálogo que ainda não têm lugares.
 *  Ordem: os mais escolhidos na nova viagem, depois o Brasil, depois o ranking dos mais visitados. */
export async function preCarregar(): Promise<number> {
  const rows = await sql`
    WITH alvo AS (
      SELECT id, row_number() OVER (ORDER BY escolhas DESC, (pais_iso = 'BR') DESC, ranking NULLS LAST, populacao DESC NULLS LAST) AS n
      FROM destinations d
      WHERE wikidata IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM pois p WHERE p.destination_id = d.id AND p.active)
        AND (import_status IS NULL OR (import_status = 'falhou' AND import_em < now() - interval '1 hour'))
    )
    UPDATE destinations d SET import_status = 'fila', import_prioridade = 1, import_erro = NULL,
      import_em = now() + make_interval(secs => alvo.n / 1000.0)
    FROM alvo WHERE d.id = alvo.id
    RETURNING d.id`;
  return rows.length;
}

/** Tira da fila só o que veio da pré-carga (pedido de viajante continua). */
export async function cancelarPreCarga(): Promise<number> {
  const rows = await sql`UPDATE destinations SET import_status = NULL, import_prioridade = 0 WHERE import_status = 'fila' AND import_prioridade > 0 RETURNING id`;
  return rows.length;
}
