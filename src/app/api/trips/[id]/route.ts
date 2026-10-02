import { apiTraveler, fail, ok, readBody } from "@/lib/api";
import { getTripForUser } from "@/lib/data";
import { sql } from "@/lib/db";

// Link de compartilhamento (só quem organiza).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await apiTraveler();
  if (!u) return fail("Entre de novo para continuar.", 401);
  const trip = await getTripForUser(Number((await ctx.params).id), u);
  if (!trip) return fail("Viagem não encontrada.", 404);
  if (trip.access !== "owner") return fail("Só quem organiza a viagem muda o compartilhamento.", 403);
  const b = await readBody<{ sharePublic: boolean; hideRes: boolean }>(req);
  const sharePublic = typeof b.sharePublic === "boolean" ? b.sharePublic : trip.sharePublic;
  const hideRes = typeof b.hideRes === "boolean" ? b.hideRes : trip.hideRes;
  await sql`UPDATE trips SET share_public = ${sharePublic}, hide_res = ${hideRes} WHERE id = ${trip.id}`;
  return ok({ sharePublic, hideRes });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await apiTraveler();
  if (!u) return fail("Entre de novo para continuar.", 401);
  const trip = await getTripForUser(Number((await ctx.params).id), u);
  if (!trip) return fail("Viagem não encontrada.", 404);
  if (trip.access !== "owner") return fail("Só quem organiza pode excluir a viagem.", 403);
  await sql`DELETE FROM trips WHERE id = ${trip.id}`;
  return ok({ redirect: "/app" });
}
