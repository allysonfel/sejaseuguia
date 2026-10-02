import { apiTraveler, fail, ok, readBody, str } from "@/lib/api";
import { sql } from "@/lib/db";
import type { Prefs } from "@/lib/auth";

// Atualiza nome, foto e preferências de privacidade da própria conta.
export async function PUT(req: Request) {
  const u = await apiTraveler();
  if (!u) return fail("Entre de novo para continuar.", 401);
  const b = await readBody<{ nome: string; avatar: string | null; prefs: Partial<Prefs> }>(req);
  if (b.nome !== undefined) {
    const nome = str(b.nome, 80);
    if (!nome) return fail("O nome não pode ficar vazio.");
    await sql`UPDATE users SET nome = ${nome} WHERE id = ${u.id}`;
  }
  if (b.avatar !== undefined) {
    const a = b.avatar;
    if (a !== null && (typeof a !== "string" || !/^data:image\/(jpeg|png|webp);base64,/.test(a) || a.length > 300_000))
      return fail("Foto inválida ou grande demais.");
    await sql`UPDATE users SET avatar = ${a} WHERE id = ${u.id}`;
  }
  if (b.prefs) {
    const prefs: Prefs = { ...u.prefs };
    for (const k of ["location", "history", "offers"] as const) if (typeof b.prefs[k] === "boolean") prefs[k] = b.prefs[k]!;
    await sql`UPDATE users SET prefs = ${sql.json(prefs)} WHERE id = ${u.id}`;
    return ok({ prefs });
  }
  return ok();
}
