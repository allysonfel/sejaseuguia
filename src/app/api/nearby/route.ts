import { apiTraveler, fail, ok } from "@/lib/api";
import { mapPoi } from "@/lib/data";
import { ensureSchema, sql } from "@/lib/db";
import { haversineKm } from "@/lib/engine";

// Lugares cadastrados perto de uma coordenada (até 1,5 km), do mais perto pro mais longe.
export async function GET(req: Request) {
  if (!(await apiTraveler())) return fail("Entre de novo para continuar.", 401);
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get("lat")), lng = Number(u.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return fail("Localização inválida.");
  await ensureSchema();
  const rows = await sql<Parameters<typeof mapPoi>[0][]>`
    SELECT * FROM pois WHERE active AND lat BETWEEN ${lat - 0.02} AND ${lat + 0.02} AND lng BETWEEN ${lng - 0.025} AND ${lng + 0.025}`;
  const here = { lat, lng };
  const pois = rows
    .map(mapPoi)
    .map((p) => ({ ...p, dist: Math.round(haversineKm(here, p) * 1000) }))
    .filter((p) => p.dist <= 1500)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 6);
  return ok({ pois });
}
