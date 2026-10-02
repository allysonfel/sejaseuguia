import { apiTraveler, fail, isDate, isTime, ok, readBody, str } from "@/lib/api";
import { getTripForUser, listReservations, logActivity, logReplan } from "@/lib/data";
import { sql } from "@/lib/db";
import { addPoi, fixConflicts } from "@/lib/engine";
import { daysBetween, toMin, weekday } from "@/lib/format";
import { lastDayEnd, tripCtx } from "@/lib/tripOps";
import type { ReservationType } from "@/lib/types";

const TYPES: ReservationType[] = ["Voo", "Hotel", "Transfer", "Restaurante", "Passeio ou ingresso", "Aluguel de carro", "Seguro"];

// Nova reserva. Se estiver ligada a um lugar do destino e cair dentro da
// viagem, o lugar entra travado no horário e o resto do dia se reorganiza.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await apiTraveler();
  if (!u) return fail("Entre de novo para continuar.", 401);
  const trip = await getTripForUser(Number((await ctx.params).id), u);
  if (!trip) return fail("Viagem não encontrada.", 404);
  if (trip.access === "viewer") return fail("Você pode ver esta viagem, mas não editar.", 403);
  const b = await readBody<{ tipo: string; nome: string; data: string; hora: string; codigo: string; info: string; poiId: number }>(req);
  const tipo = TYPES.includes(b.tipo as ReservationType) ? (b.tipo as ReservationType) : null;
  if (!tipo) return fail("Escolha o tipo de reserva.");
  const nome = str(b.nome, 120);
  if (!nome) return fail("Dê um nome para a reserva.");
  const data = str(b.data, 10) || null;
  if (data && !isDate(data)) return fail("Data inválida.");
  const hora = str(b.hora, 5) || null;
  if (hora && !isTime(hora)) return fail("Horário inválido. Use o formato 14:30.");
  let poiId = Number(b.poiId) || null;
  if (poiId) {
    const p = await sql`SELECT 1 FROM pois WHERE id = ${poiId} AND destination_id = ${trip.destinationId}`;
    if (!p.length) poiId = null;
  }

  const [res] = await sql<{ id: number }[]>`
    INSERT INTO reservations (trip_id, tipo, nome, data, hora, codigo, info, poi_id)
    VALUES (${trip.id}, ${tipo}, ${nome}, ${data}, ${hora}, ${str(b.codigo, 60) || null}, ${str(b.info, 200) || null}, ${poiId})
    RETURNING id`;

  let days = trip.days;
  let note = "Reserva salva.";
  const inTrip = data && data >= trip.inicio && data <= trip.fim;
  if (poiId && inTrip) {
    const c = await tripCtx(trip, u);
    const idx = daysBetween(trip.inicio, data);
    days = addPoi(days, idx, poiId, c, hora).days;
    days[idx] = fixConflicts(days[idx], idx, c);
    note = "Reserva salva. O Dia " + (idx + 1) + " foi ajustado" + (hora ? " ao horário " + hora : "") + ".";
    const p = c.pois[poiId];
    if (p && p.closedDays.includes(weekday(data))) note += " Atenção: " + p.nome + " costuma fechar nesse dia da semana.";
    else if (p && hora && (toMin(hora) < toMin(p.abre) || (p.fecha !== "23:59" && toMin(hora) >= toMin(p.fecha))))
      note += " Atenção: " + p.nome + " funciona das " + p.abre + " às " + p.fecha + ". Confira o horário da reserva.";
  }
  if (tipo === "Voo" && data === trip.fim) {
    const all = await listReservations([trip.id]);
    const end = lastDayEnd(trip, all);
    if (end) {
      const c = await tripCtx(trip, u);
      const last = days.length - 1;
      days = days.map((d, i) => (i === last ? fixConflicts({ ...d, endFixed: end }, i, c) : d));
      note = "Voo salvo. O último dia termina às " + end + " para dar tempo de ir ao aeroporto.";
    }
  }
  let version = trip.version;
  if (days !== trip.days) {
    const [r] = await sql<{ version: number }[]>`UPDATE trips SET days = ${sql.json(days)}, version = version + 1 WHERE id = ${trip.id} RETURNING version`;
    version = r.version;
    await logReplan(trip.id, u.id, "reservation");
  }
  await logActivity(trip.id, u.id, "Adicionou a reserva " + nome);
  const [reservation] = await listReservations([trip.id]).then((l) => l.filter((x) => x.id === res.id));
  return ok({ reservation, days, version, note });
}
