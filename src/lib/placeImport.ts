import { sql } from "./db";
import { traduzirLugares } from "./iaTexto";
import { appUrl } from "./mail";
import type { Destination } from "./types";

// Importação de lugares de um destino a partir de dados abertos:
// - Wikidata: o que existe ao redor do centro, de que tipo é, nome em português
//   e quão conhecido é (número de páginas da Wikipédia/Wikimedia sobre o lugar);
// - Wikipédia em português: o resumo histórico;
// - OpenStreetMap (quando responde): horário de funcionamento e restaurantes perto
//   das principais atrações.
// Pelo painel, tudo entra desativado para a equipe revisar antes de ir para os roteiros.
// No modo automático (viajante escolheu um destino sem lugares, ver importFila.ts) entra
// ativo e marcado como não revisado.

const UA = () => "SejaSeuGuia/0.1 (" + appUrl() + ")";
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];

export type ImportResult = { atracoes: number; restaurantes: number; repetidos: number; avisos: string[]; atualizados?: number };

// ------------------------------------------------------------ tipos de lugar

type Kind = { cat: string; dur: number; preco: number; indoor: boolean; meal?: boolean; tags: string[]; abre: string; fecha: string };

// Classes do Wikidata que viram lugar de roteiro, em ordem de prioridade:
// o Coliseu é sítio arqueológico e museu, e deve ser tratado como ruína.
const KINDS: { q: string[]; k: Kind }[] = [
  { q: ["Q43501", "Q2281788", "Q194195"], k: { cat: "Experiência", dur: 150, preco: 3, indoor: false, tags: ["família", "entretenimento"], abre: "10:00", fecha: "18:00" } },
  { q: ["Q11315", "Q216107"], k: { cat: "Compras", dur: 90, preco: 2, indoor: true, tags: ["compras"], abre: "10:00", fecha: "21:00" } },
  { q: ["Q16970", "Q24398318", "Q163687", "Q2977", "Q120560", "Q44613"], k: { cat: "Atração", dur: 40, preco: 0, indoor: true, tags: ["história", "arquitetura"], abre: "09:00", fecha: "18:00" } },
  { q: ["Q839954", "Q109607"], k: { cat: "Atração", dur: 75, preco: 2, indoor: false, tags: ["história", "arquitetura"], abre: "09:00", fecha: "18:00" } },
  { q: ["Q23413", "Q16560", "Q57821", "Q1785071"], k: { cat: "Atração", dur: 90, preco: 2, indoor: true, tags: ["história", "arquitetura"], abre: "10:00", fecha: "18:00" } },
  { q: ["Q33506", "Q1007870", "Q207694", "Q16735822", "Q17431399"], k: { cat: "Museu", dur: 90, preco: 2, indoor: true, tags: ["museus", "cultura"], abre: "10:00", fecha: "18:00" } },
  { q: ["Q24354", "Q153562"], k: { cat: "Experiência", dur: 60, preco: 1, indoor: true, tags: ["cultura", "arquitetura"], abre: "10:00", fecha: "18:00" } },
  { q: ["Q40080"], k: { cat: "Praia", dur: 150, preco: 0, indoor: false, tags: ["praias", "natureza"], abre: "07:00", fecha: "18:00" } },
  { q: ["Q22698", "Q1107656"], k: { cat: "Parque", dur: 60, preco: 0, indoor: false, tags: ["natureza", "fotografia"], abre: "08:00", fecha: "20:00" } },
  { q: ["Q6017969", "Q12518"], k: { cat: "Atração", dur: 40, preco: 1, indoor: false, tags: ["fotografia", "arquitetura"], abre: "09:00", fecha: "21:00" } },
  { q: ["Q4989906", "Q5003624", "Q483453", "Q174782", "Q12280"], k: { cat: "Atração", dur: 25, preco: 0, indoor: false, tags: ["história", "fotografia"], abre: "00:00", fecha: "23:59" } },
];

// Onde comer: restaurantes, cafés históricos e mercados (como Time Out Market, Café Majestic, Café Tortoni).
// São poucos no Wikidata e com pouca fama, então vêm numa consulta própria e aceitam nome no idioma local.
const FOOD: { q: string[]; k: Kind }[] = [
  { q: ["Q330284", "Q37654"], k: { cat: "Gastronomia", dur: 60, preco: 1, indoor: true, meal: true, tags: ["gastronomia", "experiências locais"], abre: "09:00", fecha: "19:00" } },
  { q: ["Q30022"], k: { cat: "Gastronomia", dur: 50, preco: 2, indoor: true, meal: true, tags: ["gastronomia", "experiências locais", "história"], abre: "08:00", fecha: "20:00" } },
  { q: ["Q11707"], k: { cat: "Restaurante", dur: 75, preco: 2, indoor: true, meal: true, tags: ["gastronomia", "experiências locais"], abre: "12:00", fecha: "23:00" } },
];
const MAX_FOOD = 10;

// Quantos de cada categoria entram no máximo (o resto a equipe cadastra à mão).
const CAPS: Record<string, number> = { Atração: 24, Museu: 10, Praia: 4, Parque: 4, Gastronomia: 3, Experiência: 3, Compras: 2 };
const MAX_SIGHTS = 42;

type Cand = {
  q: string; nome: string; lat: number; lng: number; fama: number; ptwiki: string | null; k: Kind; fonte?: string;
  /** nome não veio em português (a IA traduz depois) e artigo em outra Wikipédia ("en:Título", inglês de preferência), para o resumo */
  nomeEstrangeiro?: boolean; wiki?: string | null;
};

// Prédio famoso com título de patrimônio, mas de um tipo que o Wikidata não chama de atração
// (Casa Batlló é "prédio residencial", Livraria Lello é "livraria", La Moneda é "prédio público").
const HERITAGE: Kind = { cat: "Atração", dur: 45, preco: 1, indoor: true, tags: ["história", "arquitetura"], abre: "09:00", fecha: "18:00" };

type Spec = {
  /** Trecho do WHERE que escolhe os itens; pode ligar ?top a uma das classes de `kinds`. */
  where: string;
  kinds: { q: string[]; k: Kind }[];
  fallback?: Kind;
  minFama: number;
  limit: number;
  /** Aceita nome no idioma local quando não há em português (nomes próprios de cafés e restaurantes). */
  localName?: boolean;
  /** Aceita nome em inglês quando não há em português (importação automática, sem equipe para traduzir). */
  enName?: boolean;
};
const values = (kinds: { q: string[] }[]) => kinds.flatMap((x) => x.q).map((x) => "wd:" + x).join(" ");
// Um nível de subclasse só: dois níveis estouram o tempo do Wikidata em cidades densas como Paris.
const SIGHTS: Spec = { kinds: KINDS, minFama: 6, limit: 300, where: `VALUES ?top { ${values(KINDS)} } ?item wdt:P31/wdt:P279? ?top .` };
const LANDMARKS: Spec = {
  kinds: [], fallback: HERITAGE, minFama: 15, limit: 80,
  // sem ruas, bairros e estádios (o tour do estádio, quando existe, vem como museu)
  where: `?item wdt:P1435 [] .
    FILTER NOT EXISTS { ?item wdt:P31/wdt:P279? wd:Q79007 } FILTER NOT EXISTS { ?item wdt:P31/wdt:P279? wd:Q123705 }
    FILTER NOT EXISTS { ?item wdt:P31/wdt:P279? wd:Q1076486 } FILTER NOT EXISTS { ?item wdt:P31/wdt:P279? wd:Q486972 }`,
};
const EATS: Spec = {
  kinds: FOOD, minFama: 1, limit: 60, localName: true,
  // os "macellum" da Roma Antiga são mercados, mas hoje são ruínas
  where: `VALUES ?top { ${values(FOOD)} } ?item wdt:P31/wdt:P279? ?top . FILTER NOT EXISTS { ?item wdt:P31/wdt:P279? wd:Q839954 }`,
};

// Idiomas locais para o nome de cafés e restaurantes sem nome em português.
const LOCAL_LANGS: Record<string, string[]> = {
  espanha: ["es", "ca"], italia: ["it"], franca: ["fr"], argentina: ["es"], chile: ["es"], mexico: ["es"], peru: ["es"], uruguai: ["es"],
  colombia: ["es"], alemanha: ["de"], holanda: ["nl"], "paises baixos": ["nl"], grecia: ["el"], japao: ["ja"],
};

async function wikidataPlaces(dest: Destination, raioKm: number, spec: Spec): Promise<Cand[]> {
  const langs = ["pt", ...(spec.localName ? [...(LOCAL_LANGS[norm(dest.pais)] ?? []), "en"] : spec.enName ? ["en"] : [])];
  const q = `SELECT ?item ?n ?coord (GROUP_CONCAT(DISTINCT CONCAT(LANG(?l), "|", ?l); separator="¦") AS ?labels) (SAMPLE(?ptw) AS ?ptwiki) (SAMPLE(?enw) AS ?enwiki) (SAMPLE(?ow) AS ?outrawiki)
      (GROUP_CONCAT(DISTINCT STRAFTER(STR(?top), "entity/"); separator=",") AS ?tops) WHERE {
    SERVICE wikibase:around { ?item wdt:P625 ?coord . bd:serviceParam wikibase:center "Point(${dest.lng} ${dest.lat})"^^geo:wktLiteral . bd:serviceParam wikibase:radius "${raioKm}" . }
    ?item wikibase:sitelinks ?n . FILTER(?n >= ${spec.minFama})
    FILTER NOT EXISTS { ?item wdt:P576 [] }
    ${spec.where}
    OPTIONAL { ?item rdfs:label ?l FILTER(LANG(?l) IN (${langs.map((l) => '"' + l + '"').join(", ")})) }
    OPTIONAL { ?ptw schema:about ?item ; schema:isPartOf <https://pt.wikipedia.org/> }
    ${spec.enName ? `OPTIONAL { ?enw schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
    OPTIONAL { ?ow schema:about ?item ; schema:isPartOf ?site . ?site wikibase:wikiGroup "wikipedia" . FILTER(?site != <https://pt.wikipedia.org/>) }` : ""}
  } GROUP BY ?item ?n ?coord ORDER BY DESC(?n) LIMIT ${spec.limit}`;
  let res: Response | null = null;
  for (let tentativa = 0; tentativa < 2 && !res?.ok; tentativa++) {
    res = await fetch("https://query.wikidata.org/sparql", {
      method: "POST",
      headers: { "User-Agent": UA(), Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" },
      body: "query=" + encodeURIComponent(q),
      signal: AbortSignal.timeout(65000),
    }).catch(() => null);
  }
  if (!res?.ok) throw new Error("Wikidata " + res?.status);
  type B = Record<string, { value: string } | undefined>;
  const rows = ((await res.json()) as { results: { bindings: B[] } }).results.bindings;
  const out: Cand[] = [];
  const seen = new Set<string>();
  for (const b of rows) {
    const id = b.item!.value.split("/").pop()!;
    const m = b.coord?.value.match(/Point\(([-\d.]+) ([-\d.]+)\)/);
    const tops = new Set((b.tops?.value ?? "").split(","));
    const kind = spec.kinds.find((x) => x.q.some((c) => tops.has(c)))?.k ?? spec.fallback;
    const byLang = new Map((b.labels?.value ?? "").split("¦").filter(Boolean).map((x) => x.split("|") as [string, string]));
    const lang = langs.find((l) => byLang.get(l));
    const nome = lang ? byLang.get(lang) : undefined;
    if (seen.has(id) || !m || !kind || !nome) continue; // atração sem nome em português: a equipe teria de traduzir
    seen.add(id);
    // "https://hr.wikipedia.org/wiki/Revelin" → "hr:Revelin"
    const wikiDe = (u?: { value: string }) => {
      const m = u ? /^https:\/\/([a-z-]+)\.wikipedia\.org\/wiki\/(.+)$/.exec(u.value) : null;
      return m ? m[1] + ":" + decodeURIComponent(m[2]).replace(/_/g, " ") : null;
    };
    const titulo = (u?: { value: string }) => (u ? decodeURIComponent(u.value.split("/wiki/")[1] ?? "").replace(/_/g, " ") || null : null);
    out.push({
      q: id, nome: nome.slice(0, 120), lng: Number(m[1]), lat: Number(m[2]), fama: Number(b.n?.value ?? 0), ptwiki: titulo(b.ptwiki), k: kind,
      nomeEstrangeiro: lang !== "pt" && !spec.localName, wiki: wikiDe(b.enwiki) ?? wikiDe(b.outrawiki),
    });
  }
  return out;
}

/** Primeiro parágrafo dos artigos da Wikipédia em português (até 20 títulos por chamada). */
const wikipediaPt = (titles: string[]) => wikipedia("pt", titles);

async function wikipedia(lingua: string, titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!/^[a-z-]{2,12}$/.test(lingua)) return out;
  for (let i = 0; i < titles.length; i += 20) {
    // a API devolve só parte dos resumos quando o lote é grande e pede para continuar (excontinue)
    let cont: string | undefined;
    for (let volta = 0; volta < 10; volta++) {
      const p = new URLSearchParams({
        action: "query", prop: "extracts", exintro: "1", explaintext: "1", exlimit: "20", redirects: "1", format: "json",
        titles: titles.slice(i, i + 20).join("|"), ...(cont ? { excontinue: cont } : {}),
      });
      const res = await fetch(`https://${lingua}.wikipedia.org/w/api.php?` + p, { headers: { "User-Agent": UA() }, signal: AbortSignal.timeout(30000) }).catch(() => null);
      if (!res?.ok) break;
      const data = (await res.json()) as {
        continue?: { excontinue?: string | number };
        query?: { pages?: Record<string, { title: string; extract?: string }>; redirects?: { from: string; to: string }[]; normalized?: { from: string; to: string }[] };
      };
      const alias = new Map<string, string>();
      for (const r of [...(data.query?.normalized ?? []), ...(data.query?.redirects ?? [])]) alias.set(r.to, alias.get(r.from) ?? r.from);
      for (const pg of Object.values(data.query?.pages ?? {})) {
        const txt = trimText(pg.extract ?? "");
        if (txt) out.set(alias.get(pg.title) ?? pg.title, txt);
      }
      if (data.continue?.excontinue == null) break;
      cont = String(data.continue.excontinue);
    }
  }
  return out;
}

/** Corta no fim de uma frase, até ~700 caracteres, sem os parênteses de nome original e pronúncia. */
function trimText(s: string): string {
  const clean = s
    .replace(/\s*\([^()]*(?:pronúncia|AFI|IPA|lit\.|\bem (?:latim|italiano|francês|espanhol|catalão|inglês|alemão|grego|português|árabe|basco|galego|holandês|neerlandês|japonês|chinês|russo|turco|checo|tcheco|húngaro|polonês|mapudungun|quíchua|guarani)\b)[^()]*\)/gi, "")
    .replace(/\s*\n+\s*/g, " ").replace(/\s{2,}/g, " ").replace(/\s+([,.;])/g, "$1").trim();
  if (clean.length <= 700) return clean;
  const cut = clean.slice(0, 700);
  const end = cut.lastIndexOf(". ");
  return end > 200 ? cut.slice(0, end + 1) : cut.trimEnd() + "…";
}

// ------------------------------------------------------------ OpenStreetMap (complemento)

type Tags = Record<string, string>;
type OsmEl = { id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Tags };

// O servidor público do OSM às vezes fica sobrecarregado: desiste rápido de cada um e tenta um espelho.
async function overpass(query: string, timeoutMs = 30000): Promise<OsmEl[]> {
  let erro: unknown;
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "User-Agent": UA(), "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error("Overpass " + res.status);
      return ((await res.json()) as { elements: OsmEl[] }).elements;
    } catch (e) {
      erro = e;
    }
  }
  throw erro;
}

const DAYS: Record<string, number> = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 };
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toTime = (m: number) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");

/** Entende os formatos simples de horário do OSM ("Tu-Su 09:00-19:00", "Mo-Fr 10:00-18:00; Sa 10:00-14:00; Su off", "24/7").
 *  Regras com meses, feriados ou exceções são ignoradas e o lugar fica com o horário padrão da categoria. */
export function parseOpeningHours(oh: string | undefined): { abre: string; fecha: string; closedDays: number[] } | null {
  if (!oh) return null;
  const s = oh.trim();
  if (s === "24/7") return { abre: "00:00", fecha: "23:59", closedDays: [] };
  const open = new Set<number>();
  let ini = Infinity, fim = -Infinity, sawDays = false;
  for (const rule of s.split(";").map((r) => r.trim()).filter(Boolean)) {
    if (/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|PH|SH|week|sunrise|sunset|dawn|dusk)\b|\[/.test(rule)) continue;
    const m = rule.match(/^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*[-,]\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))*)?\s*(.*)$/);
    if (!m) continue;
    const days = new Set<number>();
    if (m[1]) {
      sawDays = true;
      for (const part of m[1].split(",").map((x) => x.trim())) {
        const [a, b] = part.split("-").map((x) => DAYS[x.trim()]);
        if (b == null) days.add(a);
        else for (let d = a; ; d = (d + 1) % 7) { days.add(d); if (d === b) break; }
      }
    } else for (let d = 0; d < 7; d++) days.add(d);
    const rest = m[2].trim();
    if (/^(off|closed)$/i.test(rest)) { days.forEach((d) => open.delete(d)); continue; }
    const times = [...rest.matchAll(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/g)];
    if (!times.length) continue;
    for (const t of times) {
      const a = toMin(t[1]);
      let b = toMin(t[2] === "24:00" ? "23:59" : t[2]);
      if (b <= a) b = 1439; // passa da meia-noite
      ini = Math.min(ini, a);
      fim = Math.max(fim, b);
    }
    days.forEach((d) => open.add(d));
  }
  if (!Number.isFinite(ini) || !open.size) return null;
  return { abre: toTime(ini), fecha: toTime(fim), closedDays: sawDays ? [0, 1, 2, 3, 4, 5, 6].filter((d) => !open.has(d)) : [] };
}

// Cozinha típica do país, para preferir restaurantes locais.
const CUISINE: Record<string, string[]> = {
  portugal: ["portuguese"], italia: ["italian", "roman", "regional"], franca: ["french"], espanha: ["spanish", "catalan", "tapas", "basque"],
  argentina: ["argentinian", "argentine", "steak_house", "parrilla"], chile: ["chilean"], brasil: ["brazilian", "regional"],
  mexico: ["mexican"], peru: ["peruvian"], uruguai: ["uruguayan", "steak_house"], grecia: ["greek"], alemanha: ["german"], japao: ["japanese"],
};

const coord = (e: OsmEl) => ({ lat: e.lat ?? e.center?.lat ?? 0, lng: e.lon ?? e.center?.lon ?? 0 });
const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = Math.PI / 180, x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r), y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
};
export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const bairroOf = (t: Tags) => (t["addr:suburb"] || t["addr:quarter"] || t["addr:neighbourhood"] || "").slice(0, 60);

// ------------------------------------------------------------ importação

type Draft = {
  nome: string; cat: string; bairro: string; lat: number; lng: number; dur: number; abre: string; fecha: string; preco: number;
  indoor: boolean; meal: boolean; tags: string[]; closedDays: number[]; historia: string | null; tip: string | null; source: string;
  estimado: boolean;
  /** automático: nome a traduzir e/ou história a resumir da Wikipédia em inglês (feito depois, por traduzirPendentes) */
  pendente: { wiki: string | null } | null;
};

// ------------------------------------------------------------ atrações do OSM (complemento automático)

const MIN_AUTO = 15;
const OSM_KIND: Record<string, Kind> = {
  museum: { cat: "Museu", dur: 75, preco: 1, indoor: true, tags: ["museus", "cultura"], abre: "10:00", fecha: "17:00" },
  gallery: { cat: "Museu", dur: 45, preco: 1, indoor: true, tags: ["museus", "cultura"], abre: "10:00", fecha: "18:00" },
  viewpoint: { cat: "Atração", dur: 30, preco: 0, indoor: false, tags: ["fotografia", "natureza"], abre: "07:00", fecha: "19:00" },
  theme_park: { cat: "Experiência", dur: 180, preco: 3, indoor: false, tags: ["família", "entretenimento"], abre: "10:00", fecha: "18:00" },
  zoo: { cat: "Experiência", dur: 150, preco: 2, indoor: false, tags: ["família", "natureza"], abre: "09:00", fecha: "17:00" },
  aquarium: { cat: "Experiência", dur: 90, preco: 2, indoor: true, tags: ["família", "natureza"], abre: "09:00", fecha: "18:00" },
  attraction: { cat: "Atração", dur: 45, preco: 1, indoor: false, tags: ["fotografia", "cultura"], abre: "09:00", fecha: "18:00" },
  beach: KINDS.find((x) => x.k.cat === "Praia")!.k,
};

// Lugares do OSM que valem mesmo sem Wikidata, Wikipédia, site ou horário.
const NOME_NATURAL = /^(praia|piscinas? naturais|mirante|cachoeira|lagoa|trilha|ru[ií]nas|forte|fortaleza|ilha|recife|gal[eé]s|dunas?|falésias?|cânion|canyon|gruta|parque (estadual|nacional|natural)|igreja|capela|museu)\b/i;
const NATURAL_OSM = (t: Tags) => t.natural === "beach" || t.tourism === "viewpoint" || NOME_NATURAL.test(t["name:pt"] || t.name || "");

/** Atrações com nome no OSM perto do centro, das mais "completas" (com Wikidata, Wikipédia, site, horário) para as menos. */
async function osmSights(dest: Destination, raioKm: number): Promise<{ cand: Cand; tags: Tags }[]> {
  const r = Math.min(raioKm, 15) * 1000;
  // consulta mais pesada que as outras: dá mais tempo a cada servidor
  const els = await overpass(`[out:json][timeout:55];(
    nwr(around:${r},${dest.lat},${dest.lng})["tourism"~"^(attraction|museum|gallery|viewpoint|theme_park|zoo|aquarium)$"]["name"];
    nwr(around:${r},${dest.lat},${dest.lng})["natural"="beach"]["name"];
  );out center tags;`, 60000);
  const nota = (t: Tags) => (t.wikidata ? 3 : 0) + (t.wikipedia ? 2 : 0) + (t.website || t["contact:website"] ? 1 : 0) + (t.opening_hours ? 1 : 0) + (t.image || t.wikimedia_commons ? 1 : 0);
  return els
    .filter((e) => e.tags && (e.tags.natural === "beach" || OSM_KIND[e.tags.tourism]) && !e.tags.disused && !e.tags["abandoned"])
    .map((e) => {
      const t = e.tags!;
      const wp = /^pt:(.+)$/.exec(t.wikipedia ?? "");
      const lusofono = ["brasil", "portugal"].includes(norm(dest.pais));
      return {
        tags: t,
        cand: {
          q: "osm" + e.id, nome: (t["name:pt"] || t.name).slice(0, 120), ...coord(e), fama: nota(t), ptwiki: wp ? wp[1] : null,
          k: t.natural === "beach" || /^praia/i.test(t["name:pt"] || t.name) ? OSM_KIND.beach : OSM_KIND[t.tourism], fonte: "OpenStreetMap",
          nomeEstrangeiro: !t["name:pt"] && !lusofono, wiki: t.wikipedia && !wp ? t.wikipedia : null,
        },
      };
    })
    // sem nenhum desses sinais costuma ser ruído (as miniaturas do Mini Mundo de Gramado são "attraction"),
    // menos praia, mirante e lugar com nome de atração natural ou histórica (Maragogi só tem isso no OSM)
    .filter((c) => c.cand.fama >= 1 || NATURAL_OSM(c.tags))
    .sort((a, b) => b.cand.fama - a.cand.fama || Number(NATURAL_OSM(b.tags)) - Number(NATURAL_OSM(a.tags)));
}

export async function importDestination(dest: Destination, raioKm = 8, opts: { auto?: boolean; atualizar?: boolean } = {}): Promise<ImportResult> {
  const auto = opts.auto === true;
  const raio = Math.min(20, Math.max(2, Math.round(raioKm)));
  const avisos: string[] = [];

  // 1) atrações mais conhecidas, respeitando um limite por categoria
  const used = new Map<string, number>();
  const nomes = new Set<string>();
  const sights: Cand[] = [];
  // automático: aceita lugar com menos páginas na Wikipédia (o que é famoso no Brasil costuma ter poucas);
  // como a lista vem ordenada por fama, nas cidades grandes os mais conhecidos continuam na frente
  const typed = await wikidataPlaces(dest, raio, auto ? { ...SIGHTS, minFama: 3, enName: true } : SIGHTS);
  const landmarks = await wikidataPlaces(dest, raio, LANDMARKS).catch(() => [] as Cand[]);
  const ids = new Set(typed.map((c) => c.q));
  const ranked = [...typed, ...landmarks.filter((c) => !ids.has(c.q))].sort((x, y) => y.fama - x.fama);
  for (const c of ranked) {
    if (sights.length >= MAX_SIGHTS) break;
    if (nomes.has(norm(c.nome)) || (used.get(c.k.cat) ?? 0) >= (CAPS[c.k.cat] ?? 3)) continue;
    nomes.add(norm(c.nome));
    used.set(c.k.cat, (used.get(c.k.cat) ?? 0) + 1);
    sights.push(c);
  }
  // onde comer (cafés históricos, mercados e restaurantes conhecidos); falhar aqui não impede o resto
  try {
    let n = 0;
    for (const c of await wikidataPlaces(dest, raio, EATS)) {
      if (n >= MAX_FOOD || nomes.has(norm(c.nome))) continue;
      nomes.add(norm(c.nome));
      sights.push(c);
      n++;
    }
  } catch {
    avisos.push("O Wikidata não respondeu à busca de cafés e restaurantes famosos.");
  }

  // automático com poucas atrações (cidade pequena ou pouco presente no Wikidata, como Gramado):
  // completa com as atrações do OpenStreetMap, que entram já com os dados de horário e bairro
  const osm = new Map<string, Tags>();
  if (auto && sights.filter((c) => !c.k.meal).length < MIN_AUTO) {
    try {
      for (const c of await osmSights(dest, raio)) {
        if (sights.filter((x) => !x.k.meal).length >= MIN_AUTO + 12) break;
        if (nomes.has(norm(c.cand.nome)) || sights.some((x) => km(x, c.cand) < 0.08)) continue;
        if ((used.get(c.cand.k.cat) ?? 0) >= (CAPS[c.cand.k.cat] ?? 3)) continue;
        // sem sinal e colado em outro sem sinal: parque de miniaturas ou peças de um mesmo lugar
        if (c.cand.fama === 0 && sights.some((x) => x.fonte && x.fama === 0 && km(x, c.cand) < 0.15)) continue;
        nomes.add(norm(c.cand.nome));
        used.set(c.cand.k.cat, (used.get(c.cand.k.cat) ?? 0) + 1);
        sights.push(c.cand);
        osm.set(c.cand.q, c.tags);
      }
    } catch {
      avisos.push("O OpenStreetMap não respondeu à busca de atrações.");
    }
  }

  // 2) história (Wikipédia) e, se o OSM responder, horários e bairro
  const textos = await wikipediaPt(sights.map((s) => s.ptwiki).filter((t): t is string => !!t));
  if (sights.length) {
    const lats = sights.map((s) => s.lat), lngs = sights.map((s) => s.lng);
    const bbox = [Math.min(...lats) - 0.01, Math.min(...lngs) - 0.01, Math.max(...lats) + 0.01, Math.max(...lngs) + 0.01].join(",");
    try {
      const els = await overpass(`[out:json][timeout:35];nwr["wikidata"~"^(${sights.filter((s) => !s.fonte).map((s) => s.q).join("|")})$"](${bbox});out tags;`);
      for (const e of els) if (e.tags?.wikidata && !osm.get(e.tags.wikidata)?.opening_hours) osm.set(e.tags.wikidata, e.tags);
    } catch {
      avisos.push("O OpenStreetMap não respondeu: as atrações ficaram com o horário padrão da categoria.");
    }
  }

  const drafts: Draft[] = sights.map((s) => {
    const t = osm.get(s.q) ?? {};
    const oh = parseOpeningHours(t.opening_hours);
    const txt = s.ptwiki ? textos.get(s.ptwiki) : null;
    const preco = t.fee === "no" ? 0 : t.fee === "yes" ? Math.max(1, s.k.preco) : s.k.preco;
    return {
      nome: s.nome, cat: s.k.cat, bairro: bairroOf(t) || (auto ? dest.nome : ""), lat: s.lat, lng: s.lng, dur: s.k.dur,
      abre: oh?.abre ?? s.k.abre, fecha: oh?.fecha ?? s.k.fecha, preco, indoor: s.k.indoor, meal: s.k.meal ?? false, tags: s.k.tags,
      closedDays: oh?.closedDays ?? [], historia: txt ? txt + " (Fonte: Wikipédia)" : null,
      tip: s.fama >= 60 ? "Um dos lugares mais visitados da cidade: confira se precisa comprar ingresso com hora marcada." : null,
      source: s.fonte ?? "Wikidata", estimado: !oh,
      pendente: auto && (s.nomeEstrangeiro || (!txt && s.wiki)) ? { wiki: txt ? null : s.wiki ?? null } : null,
    };
  });

  // 3) restaurantes: o melhor perto de cada atração principal, para o almoço cair perto do roteiro
  const anchors = drafts.filter((d) => d.cat !== "Parque" && !d.meal).slice(0, 16);
  if (anchors.length) {
    // automático (cidade pequena, praia): restaurante sem tipo de cozinha no OSM e um pouco mais longe da atração
    const perto = auto ? 0.8 : 0.45;
    const local = CUISINE[norm(dest.pais)] ?? ["regional", "local"];
    const isLocal = (t: Tags) => local.some((c) => (t.cuisine ?? "").toLowerCase().includes(c));
    const score = (t: Tags) => (t.wikidata ? 4 : 0) + (isLocal(t) ? 3 : 0) + (t.website || t["contact:website"] ? 1 : 0) +
      (parseOpeningHours(t.opening_hours) ? 1 : 0) + (t.brand || t["brand:wikidata"] ? -10 : 0);
    try {
      const rests = await overpass(`[out:json][timeout:35];(${anchors.map((a) => `nw(around:${perto * 1000},${a.lat},${a.lng})["amenity"="restaurant"]["name"]${auto ? "" : '["cuisine"]'};`).join("")});out center tags;`);
      const picked = new Set<number>();
      for (const a of anchors) {
        const best = rests
          // automático aceita restaurante só com o tipo de cozinha (cidade pequena raramente tem mais que isso no OSM)
          .filter((e) => !picked.has(e.id) && km(a, coord(e)) <= perto && score(e.tags!) >= (auto ? 0 : 1))
          .sort((x, y) => score(y.tags!) - score(x.tags!) || km(a, coord(x)) - km(a, coord(y)))[0];
        if (!best) continue;
        picked.add(best.id);
        const t = best.tags!;
        const oh = parseOpeningHours(t.opening_hours);
        drafts.push({
          nome: t.name.slice(0, 120), cat: "Restaurante", bairro: bairroOf(t) || a.bairro, ...coord(best), dur: 75,
          abre: oh?.abre ?? "12:00", fecha: oh?.fecha ?? "23:00", preco: 2, indoor: true, meal: true,
          tags: ["gastronomia", ...(isLocal(t) ? ["experiências locais"] : [])], closedDays: oh?.closedDays ?? [], historia: null,
          tip: "Perto de " + a.nome + (auto ? "." : ". Confira preço e horário antes de liberar."), source: "OpenStreetMap", estimado: !oh,
          pendente: auto && !t["name:pt"] && !["brasil", "portugal"].includes(norm(dest.pais)) ? { wiki: null } : null,
        });
      }
    } catch {
      avisos.push("O OpenStreetMap não respondeu: nenhum restaurante foi importado. Tente de novo mais tarde para trazer só os restaurantes.");
    }
  }

  // 4) não repete o que o destino já tem (mesmo nome, ou a menos de 60 m com nome parecido) nem o que a equipe descartou
  // nome_original: o lugar traduzido pela IA continua reconhecido pelo nome que veio dos dados abertos
  const existing = (await sql<{ nome: string; nome_original: string | null; lat: number; lng: number }[]>`
    SELECT nome, nome_original, lat, lng FROM pois WHERE destination_id = ${dest.id}`).flatMap((x) => [x, ...(x.nome_original ? [{ ...x, nome: x.nome_original }] : [])]);
  const skips = new Set((await sql<{ nome: string }[]>`SELECT nome FROM import_skips WHERE destination_id = ${dest.id}`).map((x) => x.nome));
  const isDup = (d: Draft) => skips.has(norm(d.nome)) || existing.some((x) => norm(x.nome) === norm(d.nome) || (km(x, d) < 0.06 && norm(x.nome).slice(0, 6) === norm(d.nome).slice(0, 6)));
  const fresh = drafts.filter((d) => !isDup(d));

  // atualização (reimportação periódica): os automáticos que a equipe não mexeu ganham o horário real
  // quando a fonte passou a ter, e a história se ainda não tinham. Nome (já traduzido) e o resto ficam.
  let atualizados = 0;
  if (auto && opts.atualizar) {
    const autos = await sql<{ id: number; nome: string; nome_original: string | null; lat: number; lng: number; horario_estimado: boolean; historia: string | null }[]>`
      SELECT id, nome, nome_original, lat, lng, horario_estimado, historia FROM pois WHERE destination_id = ${dest.id} AND NOT revisado`;
    for (const d of drafts) {
      const m = autos.find((x) => norm(x.nome_original ?? x.nome) === norm(d.nome) || (km(x, d) < 0.06 && norm(x.nome_original ?? x.nome).slice(0, 6) === norm(d.nome).slice(0, 6)));
      if (!m) continue;
      const horario = m.horario_estimado && !d.estimado, historia = !m.historia && d.historia;
      if (!horario && !historia) continue;
      await sql`
        UPDATE pois SET
          abre = ${horario ? d.abre : sql`abre`}, fecha = ${horario ? d.fecha : sql`fecha`},
          closed_days = ${horario ? d.closedDays : sql`closed_days`}, horario_estimado = ${horario ? false : sql`horario_estimado`},
          historia = coalesce(historia, ${d.historia})
        WHERE id = ${m.id} AND NOT revisado`;
      atualizados++;
    }
  }
  for (const d of fresh) {
    await sql`
      INSERT INTO pois (destination_id, nome, cat, bairro, lat, lng, dur, abre, fecha, preco, reserva, indoor, meal, tags,
                        closed_days, tip, historia, source, active, revisado, horario_estimado, nome_original, pendente_ia)
      VALUES (${dest.id}, ${d.nome}, ${d.cat}, ${d.bairro}, ${d.lat}, ${d.lng}, ${d.dur}, ${d.abre}, ${d.fecha}, ${d.preco},
              false, ${d.indoor}, ${d.meal}, ${d.tags}, ${d.closedDays}, ${d.tip}, ${d.historia}, ${d.source}, ${auto}, ${!auto}, ${d.estimado},
              ${d.pendente ? d.nome : null}, ${d.pendente ? sql.json(d.pendente) : null})`;
  }
  const rest = fresh.filter((d) => d.meal).length;
  return { atracoes: fresh.length - rest, restaurantes: rest, repetidos: drafts.length - fresh.length, avisos, atualizados };
}

// ------------------------------------------------------------ tradução dos automáticos (IA de texto)

/** Lugares importados automaticamente com nome estrangeiro ou sem história em português: a IA traduz o nome
 *  e resume a Wikipédia em inglês. O que a IA não conseguir fica pendente para a próxima rodada da fila. */
export async function traduzirPendentes(dest: Destination): Promise<number> {
  const rows = await sql<{ id: number; nome: string; historia: string | null; pendente_ia: { wiki?: string | null } }[]>`
    SELECT id, nome, historia, pendente_ia FROM pois WHERE destination_id = ${dest.id} AND pendente_ia IS NOT NULL ORDER BY id`;
  if (!rows.length) return 0;
  // textos de outras Wikipédias, agrupados por língua ("en:Sponza Palace", "hr:Revelin")
  const textos = new Map<string, string>();
  const porLingua = new Map<string, string[]>();
  for (const w of rows.map((r) => r.pendente_ia.wiki).filter((t): t is string => !!t)) {
    const [lingua, ...resto] = w.split(":");
    porLingua.set(lingua, [...(porLingua.get(lingua) ?? []), resto.join(":")]);
  }
  for (const [lingua, titulos] of porLingua) (await wikipedia(lingua, titulos)).forEach((v, k) => textos.set(lingua + ":" + k, v));
  const itens = rows.map((r, i) => ({ i, nome: r.nome, texto: (r.pendente_ia.wiki && textos.get(r.pendente_ia.wiki)) || "" }));
  console.log(`[ia-texto] ${dest.nome}: ${itens.length} lugares, ${itens.filter((x) => x.texto).length} com texto de outra Wikipédia`);
  const tr = await traduzirLugares(dest.nome, dest.pais, itens);
  let n = 0;
  for (const it of itens) {
    const t = tr.get(it.i);
    if (!t) continue;
    const historia = rows[it.i].historia ?? (t.historia && it.texto ? t.historia + " (Fonte: Wikipédia, resumo traduzido por IA)" : null);
    await sql`UPDATE pois SET nome = ${t.nome}, historia = ${historia}, pendente_ia = NULL WHERE id = ${rows[it.i].id} AND NOT revisado`;
    n++;
  }
  return n;
}
