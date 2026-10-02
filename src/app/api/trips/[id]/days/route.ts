import { apiTraveler, fail, isTime, ok, readBody, str } from "@/lib/api";
import { getTripForUser, logActivity, logReplan } from "@/lib/data";
import { sql } from "@/lib/db";
import { REPLAN_LABELS, type DayPlan, type Item, type ReplanKind } from "@/lib/types";

function cleanDays(raw: unknown, nDays: number, valid: Set<number>): DayPlan[] | null {
  if (!Array.isArray(raw) || raw.length !== nDays) return null;
  const out: DayPlan[] = [];
  for (const d of raw as DayPlan[]) {
    if (!d || !Array.isArray(d.items) || d.items.length > 15) return null;
    const start = Math.round(Number(d.start));
    if (!(start >= 300 && start <= 1200)) return null;
    const items: Item[] = [];
    for (const it of d.items) {
      if (!valid.has(Number(it?.p))) return null;
      const x: Item = { p: Number(it.p) };
      if (it.fixed) { if (!isTime(String(it.fixed))) return null; x.fixed = String(it.fixed); }
      if (it.dur != null) { const n = Math.round(Number(it.dur)); if (!(n >= 10 && n <= 600)) return null; x.dur = n; }
      if (it.done) x.done = true;
      items.push(x);
    }
    out.push({ start, items, endFixed: d.endFixed && isTime(String(d.endFixed)) ? String(d.endFixed) : null });
  }
  return out;
}

// Salva o roteiro editado no app. "version" evita sobrescrever a edição de outra pessoa.
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await apiTraveler();
  if (!u) return fail("Entre de novo para continuar.", 401);
  const trip = await getTripForUser(Number((await ctx.params).id), u);
  if (!trip) return fail("Viagem não encontrada.", 404);
  if (trip.access === "viewer") return fail("Você pode ver este roteiro, mas não editar.", 403);
  const b = await readBody<{ days: DayPlan[]; version: number; kind: ReplanKind; activity: string }>(req);
  const valid = new Set((await sql<{ id: number }[]>`SELECT id FROM pois WHERE destination_id = ${trip.destinationId}`).map((r) => r.id));
  const days = cleanDays(b.days, trip.days.length, valid);
  if (!days) return fail("Roteiro inválido.");
  const rows = await sql<{ version: number }[]>`
    UPDATE trips SET days = ${sql.json(days)}, version = version + 1
    WHERE id = ${trip.id} AND version = ${Number(b.version)} RETURNING version`;
  if (!rows[0]) return fail("Alguém mudou este roteiro agora mesmo. Recarregando a versão mais nova.", 409);
  const kind = b.kind && b.kind in REPLAN_LABELS ? b.kind : null;
  if (kind) await logReplan(trip.id, u.id, kind);
  const activity = str(b.activity, 200);
  if (activity) await logActivity(trip.id, u.id, activity);
  return ok({ version: rows[0].version });
}
