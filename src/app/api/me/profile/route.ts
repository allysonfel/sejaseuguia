import { apiTraveler, fail, ok, readBody } from "@/lib/api";
import { sql } from "@/lib/db";
import type { Profile } from "@/lib/types";

const RITMOS = ["Tranquilo", "Moderado", "Intenso"];
const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 40)).slice(0, 20) : []);

export async function PUT(req: Request) {
  const u = await apiTraveler();
  if (!u) return fail("Entre de novo para continuar.", 401);
  const b = await readBody<Profile>(req);
  const profile: Profile = {
    comp: typeof b.comp === "string" ? b.comp.slice(0, 40) : "Casal",
    int: list(b.int),
    ritmo: RITMOS.includes(b.ritmo as string) ? (b.ritmo as Profile["ritmo"]) : "Moderado",
    orc: typeof b.orc === "string" ? b.orc.slice(0, 20) : "Intermediário",
    mob: list(b.mob),
    evitar: list(b.evitar),
  };
  if (!profile.int.length) return fail("Escolha ao menos um interesse.");
  await sql`UPDATE users SET profile = ${sql.json(profile)} WHERE id = ${u.id}`;
  return ok();
}
