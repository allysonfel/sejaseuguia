import { mapPoi } from "./data";
import { ensureSchema, sql } from "./db";
import { haversineKm } from "./engine";
import type { Poi } from "./types";

export type Near = Poi & { dist: number };

// Lugares cadastrados perto de uma coordenada (até 1,5 km), do mais perto pro mais longe.
export async function nearbyPois(lat: number, lng: number, limit = 6): Promise<Near[]> {
  await ensureSchema();
  const rows = await sql<Parameters<typeof mapPoi>[0][]>`
    SELECT * FROM pois WHERE active AND lat BETWEEN ${lat - 0.02} AND ${lat + 0.02} AND lng BETWEEN ${lng - 0.025} AND ${lng + 0.025}`;
  const here = { lat, lng };
  return rows
    .map(mapPoi)
    .map((p) => ({ ...p, dist: Math.round(haversineKm(here, p) * 1000) }))
    .filter((p) => p.dist <= 1500)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, limit);
}

export function validCoords(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}
