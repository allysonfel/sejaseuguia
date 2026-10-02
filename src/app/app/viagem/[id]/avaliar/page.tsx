import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import TabBar from "@/components/TabBar";
import { requireTraveler } from "@/lib/auth";
import { getRules, getTripForUser, poisForTrip, tripStatus } from "@/lib/data";
import { sql } from "@/lib/db";
import { schedAll } from "@/lib/engine";
import { km1, rangeTxt } from "@/lib/format";
import Rate from "./Rate";

export default async function Avaliar({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireTraveler();
  const trip = await getTripForUser(Number((await params).id), u);
  if (!trip) notFound();
  const [pois, rules] = await Promise.all([poisForTrip(trip), getRules()]);
  const s = schedAll(trip.days, { pois, hotel: trip.hotel, profile: u.profile, rules, inicio: trip.inicio });
  const visited = [...new Map(s.flatMap((d) => d.items.map((i) => [i.p, i.poi] as const))).values()];
  const km = s.reduce((a, d) => a + d.walk, 0);
  const rows = await sql<{ poi_id: number; stars: number }[]>`SELECT poi_id, stars FROM ratings WHERE user_id = ${u.id} AND trip_id = ${trip.id}`;
  const ended = tripStatus(trip) === "Encerrada";
  return (
    <>
      <AppHeader title={trip.destino} sub={ended ? "Viagem encerrada" : "Avaliar lugares"} back="/app" avatar={u.avatar} />
      <div className="a-body">
        <div className="pad">
          <div className="box" style={{ background: "var(--sea)", borderColor: "var(--sea)", color: "#fff" }}>
            <div style={{ fontSize: 12.5, opacity: 0.8 }}>{rangeTxt(trip.inicio, trip.fim)}</div>
            <div className="serif" style={{ fontSize: 24, fontWeight: 600, margin: "2px 0 10px" }}>
              {trip.days.length} {trip.days.length === 1 ? "dia" : "dias"}, {visited.length} lugares, {km1(km)} km a pé
            </div>
            {!ended && <div style={{ fontSize: 12.5 }}>A viagem ainda não terminou, mas você já pode avaliar o que visitou.</div>}
          </div>
          <Rate tripId={trip.id} places={visited.map((p) => ({ id: p.id, nome: p.nome, cat: p.cat }))} initial={Object.fromEntries(rows.map((r) => [r.poi_id, r.stars]))} />
        </div>
      </div>
      <TabBar />
    </>
  );
}
