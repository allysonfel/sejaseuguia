import { apiTraveler, fail, ok, readBody } from "@/lib/api";
import { ensureSchema, sql } from "@/lib/db";

// Guarda o lugar em "Minhas descobertas".
export async function POST(req: Request) {
  const u = await apiTraveler();
  if (!u) return fail("Entre de novo para continuar.", 401);
  const poiId = Number((await readBody<{ poiId: number }>(req)).poiId);
  if (!poiId) return fail("Lugar inválido.");
  await ensureSchema();
  await sql`
    INSERT INTO discoveries (user_id, poi_id) SELECT ${u.id}, id FROM pois WHERE id = ${poiId}
    ON CONFLICT (user_id, poi_id) DO UPDATE SET created_at = now()`;
  return ok();
}
