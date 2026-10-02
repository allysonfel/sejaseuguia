import { fail, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { appUrl } from "@/lib/mail";

// Busca de endereço/hotel no Nominatim (OpenStreetMap, gratuito). Passa pelo
// servidor para mandar o User-Agent exigido pela política de uso deles.
export async function GET(req: Request) {
  if (!(await getCurrentUser())) return fail("Entre de novo para continuar.", 401);
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 3) return ok({ results: [] });
  const lat = Number(u.searchParams.get("lat")), lng = Number(u.searchParams.get("lng"));
  const p = new URLSearchParams({ format: "jsonv2", q, limit: "6", "accept-language": "pt-BR", addressdetails: "0" });
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng)) {
    p.set("viewbox", [lng - 0.35, lat + 0.35, lng + 0.35, lat - 0.35].join(","));
    p.set("bounded", "1");
  }
  try {
    const res = await fetch("https://nominatim.openstreetmap.org/search?" + p, {
      headers: { "User-Agent": "SejaSeuGuia/0.1 (" + appUrl() + ")" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return fail("A busca de endereços está indisponível agora. Marque o hotel no mapa.", 502);
    const data = (await res.json()) as { display_name: string; name?: string; lat: string; lon: string }[];
    return ok({
      results: data.map((r) => ({ nome: r.name || r.display_name.split(",")[0], endereco: r.display_name, lat: Number(r.lat), lng: Number(r.lon) })),
    });
  } catch {
    return fail("A busca de endereços está indisponível agora. Marque o hotel no mapa.", 502);
  }
}
