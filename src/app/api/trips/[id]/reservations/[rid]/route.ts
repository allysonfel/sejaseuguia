import { apiTraveler, fail, ok } from "@/lib/api";
import { getTripForUser, logActivity } from "@/lib/data";
import { sql } from "@/lib/db";

// Remove a reserva e destrava o horário da parada ligada a ela.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; rid: string }> }) {
  const u = await apiTraveler();
  if (!u) return fail("Entre de novo para continuar.", 401);
  const p = await ctx.params;
  const trip = await getTripForUser(Number(p.id), u);
  if (!trip) return fail("Viagem não encontrada.", 404);
  if (trip.access === "viewer") return fail("Você pode ver esta viagem, mas não editar.", 403);
  const [r] = await sql<{ nome: string; tipo: string; poi_id: number | null; data: string | null }[]>`
    DELETE FROM reservations WHERE id = ${Number(p.rid)} AND trip_id = ${trip.id} RETURNING nome, tipo, poi_id, data::text AS data`;
  if (!r) return fail("Reserva não encontrada.", 404);
  let days = trip.days;
  if (r.poi_id) days = days.map((d) => ({ ...d, items: d.items.map((it) => (it.p === r.poi_id ? { ...it, fixed: null } : it)) }));
  if (r.tipo === "Voo" && r.data === trip.fim) days = days.map((d, i) => (i === days.length - 1 ? { ...d, endFixed: null } : d));
  let version = trip.version;
  if (days !== trip.days) {
    const [x] = await sql<{ version: number }[]>`UPDATE trips SET days = ${sql.json(days)}, version = version + 1 WHERE id = ${trip.id} RETURNING version`;
    version = x.version;
  }
  await logActivity(trip.id, u.id, "Removeu a reserva " + r.nome);
  return ok({ days, version });
}
