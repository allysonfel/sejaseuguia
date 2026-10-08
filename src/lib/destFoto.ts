// Foto do destino (cards de "Destinos populares" e topo da viagem), buscada
// no Wikidata/Wikimedia Commons: grátis, sem chave e com licença aberta.
// Procura a cidade pelo nome e confere que fica perto do centro cadastrado (evita homônimos),
// pega a imagem principal dela (P18) e o crédito do autor no Commons.
// Colagem/montagem fica feia no card: aí usa o banner do Wikivoyage (P948),
// que é uma foto única, e a colagem só como último recurso.
import { sql } from "./db";
import { appUrl } from "./mail";

const UA = () => "SejaSeuGuia/0.1 (" + appUrl() + ")";
const LARGURA = 1280;

export type FotoDestino = { url: string; credito: string };

const semHtml = (s: string) => s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

type Entidade = { claims?: Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]> };

const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = Math.PI / 180, x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r), y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
};

// Wikidata às vezes devolve 429/erro passageiro: mais uma tentativa depois de 1,5 s.
async function wd<T>(params: Record<string, string>, tentativa = 1): Promise<T> {
  try {
    const res = await fetch("https://www.wikidata.org/w/api.php?" + new URLSearchParams({ ...params, format: "json", origin: "*" }), {
      headers: { "User-Agent": UA() },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return (await res.json()) as T;
  } catch (e) {
    if (tentativa >= 2) throw e;
    await new Promise((ok) => setTimeout(ok, 1500));
    return wd<T>(params, tentativa + 1);
  }
}

export async function buscarFotoDestino(nome: string, lat: number, lng: number): Promise<FotoDestino | null> {
  if (!nome.trim()) return null;
  try {
    // 1) busca pelo nome (rápida, ordenada por relevância); 2) fica com o primeiro que está a até 40 km do centro.
    const busca = await wd<{ search?: { id: string }[] }>({ action: "wbsearchentities", search: nome.trim(), language: "pt", uselang: "pt", type: "item", limit: "10" });
    const ids = (busca.search ?? []).map((x) => x.id);
    if (!ids.length) return null;
    const ents = await wd<{ entities?: Record<string, Entidade> }>({ action: "wbgetentities", ids: ids.join("|"), props: "claims" });
    for (const id of ids) {
      const c = ents.entities?.[id]?.claims ?? {};
      const pos = c.P625?.[0]?.mainsnak?.datavalue?.value as { latitude?: number; longitude?: number } | undefined;
      if (pos?.latitude == null || pos.longitude == null || km({ lat, lng }, { lat: pos.latitude, lng: pos.longitude }) > 40) continue;
      const arquivos = (p: string) => (c[p] ?? []).map((x) => x.mainsnak?.datavalue?.value).filter((v): v is string => typeof v === "string");
      const fotos = arquivos("P18"), banner = arquivos("P948")[0];
      const arquivo = fotos.find((a) => !colagem(a)) || banner || fotos[0];
      if (!arquivo) continue;
      return { url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(arquivo)}?width=${LARGURA}`, credito: await credito(arquivo) };
    }
    return null;
  } catch (e) {
    console.error("[fotos] falha ao buscar", nome + ":", (e as Error).message);
    return null;
  }
}

const colagem = (a: string) => /collage|montage|montagem|mosaic|mosaico|composite|composi/i.test(a);

// "Foto: Autor · CC BY-SA 4.0 · Wikimedia Commons"
async function credito(arquivo: string): Promise<string> {
  const p = new URLSearchParams({ action: "query", titles: "File:" + arquivo, prop: "imageinfo", iiprop: "extmetadata", format: "json", origin: "*" });
  try {
    const res = await fetch("https://commons.wikimedia.org/w/api.php?" + p, { headers: { "User-Agent": UA() }, signal: AbortSignal.timeout(15000) });
    const j = (await res.json()) as { query?: { pages?: Record<string, { imageinfo?: { extmetadata?: Record<string, { value?: string }> }[] }> } };
    const meta = Object.values(j.query?.pages ?? {})[0]?.imageinfo?.[0]?.extmetadata ?? {};
    const autor = semHtml(meta.Artist?.value ?? "").slice(0, 80);
    const licenca = semHtml(meta.LicenseShortName?.value ?? "");
    return ["Foto" + (autor ? ": " + autor : ""), licenca, "Wikimedia Commons"].filter(Boolean).join(" · ");
  } catch {
    return "Foto: Wikimedia Commons";
  }
}

/** Destinos sem foto: busca uma vez (e de novo só depois de 7 dias, se não achou). Roda em segundo plano ao subir o app. */
export async function preencherFotosFaltantes(): Promise<number> {
  const rows = await sql<{ id: number; nome: string; lat: number; lng: number }[]>`
    SELECT id, nome, lat, lng FROM destinations
    WHERE foto_url IS NULL AND (foto_buscada_em IS NULL OR foto_buscada_em < now() - interval '7 days')
    ORDER BY id LIMIT 30`;
  let n = 0;
  for (const d of rows) {
    const f = await buscarFotoDestino(d.nome, d.lat, d.lng);
    await sql`
      UPDATE destinations SET foto_buscada_em = now(), foto_url = coalesce(foto_url, ${f?.url ?? null}), foto_credito = coalesce(foto_credito, ${f?.credito ?? null})
      WHERE id = ${d.id}`;
    if (f) n++;
  }
  if (rows.length) console.log(`[fotos] ${n} de ${rows.length} destino(s) ganharam foto`);
  return n;
}
