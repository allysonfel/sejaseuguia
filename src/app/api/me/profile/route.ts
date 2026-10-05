import { apiTraveler, fail, ok, readBody } from "@/lib/api";
import { sql } from "@/lib/db";
import { parseProfile } from "@/lib/profileInput";
import type { Profile } from "@/lib/types";

export async function PUT(req: Request) {
  const u = await apiTraveler();
  if (!u) return fail("Entre de novo para continuar.", 401);
  const profile = parseProfile(await readBody<Profile>(req));
  if (!profile.int.length) return fail("Escolha ao menos um interesse.");
  await sql`UPDATE users SET profile = ${sql.json(profile)} WHERE id = ${u.id}`;
  return ok();
}
