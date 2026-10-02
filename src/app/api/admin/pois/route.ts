import { apiStaff, fail, ok, readBody } from "@/lib/api";
import { getDestination } from "@/lib/data";
import { sql } from "@/lib/db";
import { parsePoi } from "@/lib/poiInput";

export async function POST(req: Request) {
  if (!(await apiStaff("pois"))) return fail("Sem acesso.", 403);
  const b = (await readBody<Record<string, unknown>>(req)) as Record<string, unknown>;
  const dest = await getDestination(Number(b.destinationId));
  if (!dest) return fail("Destino inválido.");
  const p = parsePoi(b);
  if (typeof p === "string") return fail(p);
  const [{ id }] = await sql<{ id: number }[]>`
    INSERT INTO pois (destination_id, nome, cat, bairro, lat, lng, dur, abre, fecha, preco, reserva, indoor, meal, tags,
                      closed_days, tip, historia, curiosidades, datas, source, active)
    VALUES (${dest.id}, ${p.nome}, ${p.cat}, ${p.bairro}, ${p.lat}, ${p.lng}, ${p.dur}, ${p.abre}, ${p.fecha}, ${p.preco},
            ${p.reserva}, ${p.indoor}, ${p.meal}, ${p.tags}, ${p.closedDays}, ${p.tip}, ${p.historia},
            ${sql.json(p.curiosidades)}, ${sql.json(p.datas)}, ${p.source}, ${p.active})
    RETURNING id`;
  return ok({ id });
}
