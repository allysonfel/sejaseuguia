import { apiStaff, fail, ok, readBody } from "@/lib/api";
import { parseDest } from "@/lib/destInput";
import { sql } from "@/lib/db";

export async function POST(req: Request) {
  if (!(await apiStaff("dest"))) return fail("Sem acesso.", 403);
  const d = parseDest((await readBody<Record<string, unknown>>(req)) as Record<string, unknown>);
  if (typeof d === "string") return fail(d);
  const [{ id }] = await sql<{ id: number }[]>`
    INSERT INTO destinations (nome, pais, lat, lng, moeda, update_freq, cor1, cor2)
    VALUES (${d.nome}, ${d.pais}, ${d.lat}, ${d.lng}, ${d.moeda}, ${d.updateFreq}, ${d.cor1}, ${d.cor2}) RETURNING id`;
  return ok({ id });
}
