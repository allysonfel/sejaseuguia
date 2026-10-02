import Link from "next/link";
import Topbar from "@/components/admin/Topbar";
import { listAllTrips } from "@/lib/adminLists";
import { requireStaff } from "@/lib/auth";
import { shortRange } from "@/lib/format";
import type { TripStatus } from "@/lib/types";

const FILTERS: [string, TripStatus | undefined][] = [["Todas", undefined], ["Planejadas", "Planejada"], ["Em andamento", "Em andamento"], ["Encerradas", "Encerrada"]];
const BADGE: Record<TripStatus, string> = { Planejada: "b-navy", "Em andamento": "b-sun", Encerrada: "b-sea" };

export default async function Viagens({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaff("trips");
  const st = (await searchParams).status as TripStatus | undefined;
  const status = FILTERS.some((f) => f[1] === st) ? st : undefined;
  const rows = await listAllTrips(status);
  return (
    <>
      <Topbar title="Viagens" />
      <div className="content">
        <div className="toolbar" style={{ marginBottom: 14 }}>
          {FILTERS.map(([l, v]) => (
            <Link key={l} className={"chip " + (status === v ? "on" : "")} href={v ? "/admin/viagens?status=" + encodeURIComponent(v) : "/admin/viagens"}>{l}</Link>
          ))}
        </div>
        <div className="panel">
          <div className="tw">
            <table>
              <thead><tr><th>Destino</th><th>Organizador</th><th>Datas</th><th className="num">Dias</th><th className="num">Pessoas</th><th>Status</th><th className="num">Replanejamentos</th></tr></thead>
              <tbody>
                {rows.length === 0 && <tr className="empty-row"><td colSpan={7}>Nenhuma viagem por aqui.</td></tr>}
                {rows.map((x) => (
                  <tr key={x.id}>
                    <td><b>{x.destino}</b></td>
                    <td>{x.organizador}</td>
                    <td className="mono muted">{shortRange(x.inicio, x.fim)}</td>
                    <td className="num">{x.dias}</td>
                    <td className="num">{x.pax}</td>
                    <td><span className={"badge " + BADGE[x.status]}>{x.status}</span></td>
                    <td className="num">{x.replans}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
