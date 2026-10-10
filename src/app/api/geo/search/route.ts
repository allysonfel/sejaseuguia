import { fail, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { appUrl } from "@/lib/mail";

// Busca de endereço/hotel com dados do OpenStreetMap, gratuita.
// 1º Nominatim (passa pelo servidor para mandar o User-Agent exigido pela política de uso deles);
// se ele recusar ou demorar (limita IP compartilhado, como o do Railway), 2º Photon (komoot).
// Enquanto digita (auto=1) vai só no Photon: a política do Nominatim proíbe autocompletar.
// Resultado guardado 1 h em memória: a mesma busca não bate de novo nos serviços.

type Hit = { nome: string; endereco: string; lat: number; lng: number };
type Caixa = { lat: number; lng: number } | null;

const cache = new Map<string, { em: number; results: Hit[] }>();
const CACHE_MS = 60 * 60_000;

async function nominatim(q: string, c: Caixa): Promise<Hit[]> {
  const p = new URLSearchParams({ format: "jsonv2", q, limit: "6", "accept-language": "pt-BR", addressdetails: "0" });
  if (c) {
    p.set("viewbox", [c.lng - 0.35, c.lat + 0.35, c.lng + 0.35, c.lat - 0.35].join(","));
    p.set("bounded", "1");
  }
  const res = await fetch("https://nominatim.openstreetmap.org/search?" + p, {
    headers: { "User-Agent": "SejaSeuGuia/0.1 (" + appUrl() + ")", Referer: appUrl() },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error("Nominatim respondeu " + res.status);
  const data = (await res.json()) as { display_name: string; name?: string; lat: string; lon: string }[];
  return data.map((r) => ({ nome: r.name || r.display_name.split(",")[0], endereco: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }));
}

type PhotonProps = { name?: string; street?: string; housenumber?: string; district?: string; city?: string; state?: string; country?: string };

async function photon(q: string, c: Caixa): Promise<Hit[]> {
  const p = new URLSearchParams({ q, limit: "6" });
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
    const rua = [t.street, t.housenumber].filter(Boolean).join(", ");
    const nome = t.name || rua || t.district || t.city || q;
    return {
      nome,
      endereco: [nome, rua !== nome ? rua : "", t.district, t.city, t.state, t.country].filter(Boolean).join(", "),
      lat: geometry.coordinates[1], lng: geometry.coordinates[0],
    };
  });
}

export async function GET(req: Request) {
  if (!(await getCurrentUser())) return fail("Entre de novo para continuar.", 401);
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 3) return ok({ results: [] });
  const lat = Number(u.searchParams.get("lat")), lng = Number(u.searchParams.get("lng"));
  const caixa: Caixa = Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng) ? { lat, lng } : null;

  const auto = u.searchParams.get("auto") === "1";
  const chave = (auto ? "a|" : "") + q.toLowerCase() + "|" + (caixa ? caixa.lat.toFixed(2) + "," + caixa.lng.toFixed(2) : "");
  const salvo = cache.get(chave);
  if (salvo && Date.now() - salvo.em < CACHE_MS) return ok({ results: salvo.results });

  const fontes = auto ? ([["Photon", photon]] as const) : ([["Nominatim", nominatim], ["Photon", photon]] as const);
  for (const [nome, fonte] of fontes) {
    try {
      const results = await fonte(q, caixa);
      // Nominatim sem nada (busca por nome aproximado de hotel): o Photon costuma achar
      if (!results.length && nome === "Nominatim") continue;
      if (cache.size > 500) cache.clear();
      cache.set(chave, { em: Date.now(), results });
      return ok({ results });
    } catch (e) {
      console.error(`[geo] ${nome} falhou:`, (e as Error).message);
    }
  }
  return fail("A busca de endereços está indisponível agora. Marque o hotel no mapa.", 502);
}
