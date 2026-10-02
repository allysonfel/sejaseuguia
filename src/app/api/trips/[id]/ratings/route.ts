import { apiTraveler, fail, ok, readBody } from "@/lib/api";
import { getTripForUser } from "@/lib/data";
import { sql } from "@/lib/db";

// Nota de 1 a 5 para um lugar visitado na viagem.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await apiTraveler();
  if (!u) return fail("Entre de novo para continuar.", 401);
  const trip = await getTripForUser(Number((await ctx.params).id), u);
  if (!trip) return fail("Viagem não encontrada.", 404);
  const b = await readBody<{ poiId: number; stars: number }>(req);
  const poiId = Number(b.poiId), stars = Math.round(Number(b.stars));
  if (!trip.days.some((d) => d.items.some((i) => i.p === poiId))) return fail("Esse lugar não fez parte da viagem.");
  if (!(stars >= 1 && stars <= 5)) return fail("Nota inválida.");
  await sql`
    INSERT INTO ratings (user_id, trip_id, poi_id, stars) VALUES (${u.id}, ${trip.id}, ${poiId}, ${stars})
    ON CONFLICT (user_id, trip_id, poi_id) DO UPDATE SET stars = EXCLUDED.stars, created_at = now()`;
  return ok();
}
