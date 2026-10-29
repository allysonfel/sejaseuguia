import { fail, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { appUrl } from "@/lib/mail";

// Busca de endereço/hotel com dados do OpenStreetMap, gratuita.
// Photon (komoot) e Nominatim, pelo servidor para mandar o User-Agent exigido pela política de uso deles.
// No Enter as duas ao mesmo tempo (o Railway sai por IP compartilhado e às vezes uma delas limita);
// enquanto digita (auto=1) só o Photon: a política do Nominatim proíbe autocompletar.
// A busca vai sem o nome da cidade (a caixa em volta do destino já limita): hotel da Disney fica em
// Lake Buena Vista, não tem "Orlando" no nome e sumia. Só se achar pouco tenta de novo com a cidade.
// Hospedagem vem primeiro; ponto de ônibus, estacionamento, estação e loja ficam de fora.
// Resultado guardado 1 h em memória: a mesma busca não bate de novo nos serviços.

type Hit = { nome: string; endereco: string; lat: number; lng: number };
type Achado = Hit & { tipo: string };
type Caixa = { lat: number; lng: number } | null;

const cache = new Map<string, { em: number; results: Hit[] }>();
const CACHE_MS = 60 * 60_000;
const MAX = 8;
// Fonte que falhou fica de lado 2 min: as buscas seguintes não esperam o tempo limite dela.
const foraAte = new Map<string, number>();

const HOSPEDAGEM = new Set(["tourism:hotel", "tourism:motel", "tourism:hostel", "tourism:guest_house", "tourism:apartment", "tourism:chalet", "tourism:camp_site", "leisure:resort", "building:hotel"]);
// Fora a hospedagem, só endereço (casa, prédio, rua, bairro): loja, restaurante, estação, ponto de ônibus e piscina ficam de fora.
const MORADIA = new Set(["building:house", "building:residential", "building:apartments", "building:detached"]);
const RUA = /^(highway:(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|road)|place:)/;
const peso = (tipo: string) => (HOSPEDAGEM.has(tipo) ? 0 : MORADIA.has(tipo) ? 1 : RUA.test(tipo) ? 2 : -1);

async function nominatim(q: string, c: Caixa): Promise<Achado[]> {
  const p = new URLSearchParams({ format: "jsonv2", q, limit: "10", "accept-language": "pt-BR", addressdetails: "0" });
  if (c) {
    p.set("viewbox", [c.lng - 0.35, c.lat + 0.35, c.lng + 0.35, c.lat - 0.35].join(","));
    p.set("bounded", "1");
  }
  const res = await fetch("https://nominatim.openstreetmap.org/search?" + p, {
    headers: { "User-Agent": "SejaSeuGuia/0.1 (" + appUrl() + ")", Referer: appUrl() },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error("Nominatim respondeu " + res.status);
  const data = (await res.json()) as { display_name: string; name?: string; lat: string; lon: string; category?: string; type?: string }[];
  return data.map((r) => ({
    nome: r.name || r.display_name.split(",")[0], endereco: r.display_name, lat: Number(r.lat), lng: Number(r.lon),
    tipo: (r.category ?? "") + ":" + (r.type ?? ""),
  }));
}

type PhotonProps = { name?: string; street?: string; housenumber?: string; district?: string; city?: string; state?: string; country?: string; osm_key?: string; osm_value?: string };

async function photon(q: string, c: Caixa): Promise<Achado[]> {
  const p = new URLSearchParams({ q, limit: "15" });
  if (c) {
    p.set("lat", String(c.lat));
    p.set("lon", String(c.lng));
    p.set("bbox", [c.lng - 0.35, c.lat - 0.35, c.lng + 0.35, c.lat + 0.35].join(","));
  }
  const res = await fetch("https://photon.komoot.io/api/?" + p, {
    headers: { "User-Agent": "SejaSeuGuia/0.1 (" + appUrl() + ")" },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error("Photon respondeu " + res.status);
  const data = (await res.json()) as { features: { properties: PhotonProps; geometry: { coordinates: [number, number] } }[] };
  return data.features.map(({ properties: t, geometry }) => {
    const ruaNum = [t.street, t.housenumber].filter(Boolean).join(", ");
    const nome = t.name || ruaNum || t.district || t.city || q;
    return {
      nome,
      endereco: [nome, ruaNum !== nome ? ruaNum : "", t.district, t.city, t.state, t.country].filter(Boolean).join(", "),
      lat: geometry.coordinates[1], lng: geometry.coordinates[0],
      tipo: (t.osm_key ?? "") + ":" + (t.osm_value ?? ""),
    };
  });
}

// Hospedagem primeiro, depois endereço; um por nome a até 400 m.
function juntar(antes: Achado[], novos: Achado[], soHospedagem = false): Achado[] {
  const lista = [...antes];
  for (const a of novos) {
    const p = peso(a.tipo);
    if (p < 0 || (soHospedagem && p > 0)) continue;
    const n = a.nome.toLowerCase();
    if (lista.some((v) => v.nome.toLowerCase() === n && Math.abs(v.lat - a.lat) < 0.004 && Math.abs(v.lng - a.lng) < 0.004)) continue;
    lista.push(a);
  }
  return lista.sort((x, y) => peso(x.tipo) - peso(y.tipo));
}
const hospedagens = (l: Achado[]) => l.filter((a) => HOSPEDAGEM.has(a.tipo)).length;

export async function GET(req: Request) {
  if (!(await getCurrentUser())) return fail("Entre de novo para continuar.", 401);
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 3) return ok({ results: [] });
  const cidade = (u.searchParams.get("cidade") ?? "").trim().slice(0, 80);
  const lat = Number(u.searchParams.get("lat")), lng = Number(u.searchParams.get("lng"));
  const caixa: Caixa = Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng) ? { lat, lng } : null;

  const auto = u.searchParams.get("auto") === "1";
  const chave = (auto ? "a|" : "") + q.toLowerCase() + "|" + cidade.toLowerCase() + "|" + (caixa ? caixa.lat.toFixed(2) + "," + caixa.lng.toFixed(2) : "");
  const salvo = cache.get(chave);
  if (salvo && Date.now() - salvo.em < CACHE_MS) return ok({ results: salvo.results });

  // Enquanto digita só o Photon; no Enter as duas fontes ao mesmo tempo (uma cobre a outra quando falha ou limita).
  // Fonte que falhou sai da 2ª tentativa (não espera o tempo limite de novo).
  const todas: [string, typeof photon][] = auto ? [["Photon", photon]] : [["Photon", photon], ["Nominatim", nominatim]];
  const ativas = todas.filter(([n]) => (foraAte.get(n) ?? 0) < Date.now());
  let fontes = ativas.length ? ativas : todas;
  async function buscar(texto: string) {
    const r = await Promise.allSettled(fontes.map(([, f]) => f(texto, caixa)));
    r.forEach((x, i) => { if (x.status === "rejected") console.error(`[geo] ${fontes[i][0]} falhou:`, (x.reason as Error).message); });
    r.forEach((x, i) => (x.status === "rejected" ? foraAte.set(fontes[i][0], Date.now() + 2 * 60_000) : foraAte.delete(fontes[i][0])));
    fontes = fontes.filter((_, i) => r[i].status === "fulfilled");
    return fontes.length ? r.flatMap((x) => (x.status === "fulfilled" ? x.value : [])) : null;
  }
  // Sem a caixa (destino sem coordenada), a cidade vai junto desde a 1ª tentativa.
  const comCidade = cidade && !q.toLowerCase().includes(cidade.toLowerCase()) ? q + " " + cidade : null;
  const primeira = await buscar(caixa ? q : comCidade ?? q);
  if (!primeira) return fail("A busca de endereços está indisponível agora. Marque o hotel no mapa.", 502);
  let achados = juntar([], primeira);
  // Achou pouca hospedagem: tenta com o nome da cidade, aproveitando só hotel (o resto vira ruído, ex.: "Pop" + Orlando).
  if (caixa && comCidade && hospedagens(achados) < 3) achados = juntar(achados, (fontes.length ? await buscar(comCidade) : null) ?? [], true);
  const results = achados.slice(0, MAX).map(({ nome, endereco, lat, lng }) => ({ nome, endereco, lat, lng }));
  if (cache.size > 500) cache.clear();
  cache.set(chave, { em: Date.now(), results });
  return ok({ results });
}
