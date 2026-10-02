import { apiTraveler, fail, ok } from "@/lib/api";
import { getTripForUser, listMembers } from "@/lib/data";
import { sql } from "@/lib/db";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; mid: string }> }) {
  const u = await apiTraveler();
  if (!u) return fail("Entre de novo para continuar.", 401);
  const p = await ctx.params;
  const trip = await getTripForUser(Number(p.id), u);
  if (!trip) return fail("Viagem não encontrada.", 404);
  if (trip.access !== "owner") return fail("Só quem organiza a viagem pode remover pessoas.", 403);
  await sql`DELETE FROM trip_members WHERE id = ${Number(p.mid)} AND trip_id = ${trip.id}`;
  return ok({ members: await listMembers(trip.id) });
}
