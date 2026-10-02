import type { User } from "./auth";
import { sql } from "./db";
import { dayLabel, daysBetween, todayIso, addDays, weekday } from "./format";
import { tripStatus } from "./data";
import type { IconName } from "./icons";
import type { Reservation, Trip } from "./types";

export type Notif = { ic: IconName; t: string; d: string; href?: string };

const RES_ICON: Record<string, IconName> = {
  Voo: "plane", Hotel: "bed", Transfer: "car", Restaurante: "fork", "Passeio ou ingresso": "ticket", "Aluguel de carro": "car", Seguro: "shield",
};
export const resIcon = (tipo: string): IconName => RES_ICON[tipo] ?? "ticket";

const WD_PLURAL = ["aos domingos", "às segundas", "às terças", "às quartas", "às quintas", "às sextas", "aos sábados"];

/** Avisos calculados na hora a partir das viagens, reservas e do que os outros mexeram. */
export async function getNotifications(u: User, trips: Trip[], reservations: Reservation[]): Promise<Notif[]> {
  const today = todayIso();
  const out: Notif[] = [];
  const active = trips.filter((t) => tripStatus(t, today) !== "Encerrada");

  for (const r of reservations) {
    if (!r.data || r.data < today) continue;
    const n = daysBetween(today, r.data);
    if (n > 30) continue;
    out.push({
      ic: resIcon(r.tipo),
      t: r.tipo + ": " + r.nome,
      d: dayLabel(r.data) + (r.hora ? " · " + r.hora : "") + " · " + (n === 0 ? "hoje" : n === 1 ? "amanhã" : "em " + n + " dias"),
      href: "/app/viagem/" + r.tripId + "?aba=reservas",
    });
  }

  // lugar do roteiro marcado num dia em que ele fecha
  const ids = [...new Set(active.flatMap((t) => t.days.flatMap((d) => d.items.map((i) => i.p))))];
  if (ids.length) {
    const closed = await sql<{ id: number; nome: string; closed_days: number[] }[]>`
      SELECT id, nome, closed_days FROM pois WHERE id IN ${sql(ids)} AND cardinality(closed_days) > 0`;
    const byId = new Map(closed.map((p) => [p.id, p]));
    for (const t of active)
      t.days.forEach((d, i) => {
        const wd = weekday(addDays(t.inicio, i));
        for (const it of d.items) {
          const p = byId.get(it.p);
          if (p && p.closed_days.includes(wd))
            out.push({ ic: "alert", t: p.nome + " fecha " + WD_PLURAL[wd], d: t.destino + ", Dia " + (i + 1) + ". Toque para trocar de dia.", href: "/app/viagem/" + t.id + "?dia=" + i });
        }
      });
  }

  if (trips.length) {
    const acts = await sql<{ trip_id: number; texto: string; nome: string | null; created_at: Date }[]>`
      SELECT a.trip_id, a.texto, u.nome, a.created_at FROM trip_activity a LEFT JOIN users u ON u.id = a.user_id
      WHERE a.trip_id IN ${sql(trips.map((t) => t.id))} AND a.user_id IS DISTINCT FROM ${u.id}
        AND a.created_at > now() - interval '14 days'
      ORDER BY a.created_at DESC LIMIT 5`;
    for (const a of acts)
      out.push({ ic: "users", t: (a.nome ?? "Alguém") + " mexeu no roteiro", d: a.texto, href: "/app/viagem/" + a.trip_id });
  }

  const ended = trips.filter((t) => tripStatus(t, today) === "Encerrada");
  if (ended.length) {
    const rated = await sql<{ trip_id: number }[]>`
      SELECT DISTINCT trip_id FROM ratings WHERE user_id = ${u.id} AND trip_id IN ${sql(ended.map((t) => t.id))}`;
    const done = new Set(rated.map((r) => r.trip_id));
    for (const t of ended)
      if (!done.has(t.id) && daysBetween(t.fim, today) <= 60)
        out.push({ ic: "star", t: "Como foi " + t.destino + "?", d: "Suas avaliações melhoram as próximas sugestões.", href: "/app/viagem/" + t.id + "/avaliar" });
  }
  return out;
}
