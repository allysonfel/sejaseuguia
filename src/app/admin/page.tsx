import Link from "next/link";
import Topbar from "@/components/admin/Topbar";
import { overviewStats } from "@/lib/adminStats";
import { requireStaff } from "@/lib/auth";
import { n0 } from "@/lib/format";
import { REPLAN_LABELS, type ReplanKind } from "@/lib/types";

function Kpi({ l, v, d, hero, neg }: { l: string; v: string; d: string; hero?: boolean; neg?: boolean }) {
  return <div className={"kpi" + (hero ? " hero" : "")}><small>{l}</small><b>{v}</b><span className={"d" + (neg ? " neg" : "")}>{d}</span></div>;
}

function LineChart({ data }: { data: { dia: string; a: number; b: number }[] }) {
  const W = 640, H = 210, px = 34;
  const max = Math.max(4, ...data.map((d) => Math.max(d.a, d.b)));
  const top = Math.ceil(max / 4) * 4;
  const X = (i: number) => px + (i * (W - px - 10)) / (data.length - 1);
  const Y = (v: number) => H - 26 - (v / top) * (H - 46);
  const ticks = [0, top / 4, top / 2, (3 * top) / 4, top];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Roteiros gerados e replanejamentos nos últimos 14 dias">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={px} x2={W - 6} y1={Y(v)} y2={Y(v)} stroke="#EEF0F5" />
          <text x={px - 6} y={Y(v) + 4} fontSize="10" textAnchor="end" fill="#8D95AD" fontFamily="var(--mono)">{v}</text>
        </g>
      ))}
      <path d={`M${data.map((d, i) => X(i) + " " + Y(d.a)).join(" L")} L${X(data.length - 1)} ${Y(0)} L${X(0)} ${Y(0)}z`} fill="rgba(255,178,30,.18)" />
      <polyline points={data.map((d, i) => X(i) + "," + Y(d.a)).join(" ")} fill="none" stroke="#FFB21E" strokeWidth="3" strokeLinejoin="round" />
      <polyline points={data.map((d, i) => X(i) + "," + Y(d.b)).join(" ")} fill="none" stroke="#101B3B" strokeWidth="2.5" strokeLinejoin="round" />
      {data.map((d, i) => i % 2 === 0 && <text key={i} x={X(i)} y={H - 6} fontSize="10" textAnchor="middle" fill="#8D95AD" fontFamily="var(--mono)">{d.dia}</text>)}
    </svg>
  );
}

export default async function Overview() {
  await requireStaff("overview");
  const s = await overviewStats();
  const diff = s.tripsPrev ? Math.round(((s.tripsMonth - s.tripsPrev) / s.tripsPrev) * 100) : null;
  const maxDest = Math.max(1, ...s.dest.map((d) => d.c));
  return (
    <>
      <Topbar title="Visão geral" />
      <div className="content">
        <div className="kpis">
          <Kpi hero l="Viajantes cadastrados" v={n0(s.travelers)} d={"+" + n0(s.newTravelers) + " neste mês"} />
          <Kpi l="Roteiros gerados no mês" v={n0(s.tripsMonth)} d={diff == null ? n0(s.tripsTotal) + " no total" : (diff >= 0 ? "+" : "") + diff + "% vs mês anterior"} neg={diff != null && diff < 0} />
          <Kpi l="Viagens em andamento" v={n0(s.tripsNow)} d="Hoje" />
          <Kpi l="Replanejamentos no mês" v={n0(s.replansMonth)} d={s.replansPerTrip.toFixed(1).replace(".", ",") + " por viagem"} />
          <Kpi l="Lugares ativos" v={n0(s.poisActive)} d={s.poisStale + " desatualizados"} neg={s.poisStale > 0} />
        </div>
        <div className="grid2">
          <div className="panel">
            <div className="panel-h">
              <h3>Roteiros gerados e replanejamentos por dia</h3>
              <div className="legend"><span><i style={{ background: "#FFB21E" }} />Roteiros</span><span><i style={{ background: "#101B3B" }} />Replanejamentos</span></div>
            </div>
            <div className="panel-b"><LineChart data={s.series} /></div>
          </div>
          <div className="panel">
            <div className="panel-h"><h3>Destinos mais planejados</h3></div>
            <div className="rank">
              {s.dest.map((d, i) => (
                <div key={d.nome} className="r">
                  <span className="mono muted" style={{ width: 18 }}>{i + 1}</span>
                  <b style={{ flex: 1 }}>{d.nome}</b>
                  <div className="bar"><i style={{ width: (d.c / maxDest) * 100 + "%" }} /></div>
                  <span className="mono" style={{ width: 34, textAlign: "right" }}>{d.c}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="panel">
            <div className="panel-h"><h3>O que mais faz o roteiro mudar</h3></div>
            <div className="rank">
              {s.reasons.length === 0 && <div className="r muted">Nenhum replanejamento registrado ainda.</div>}
              {s.reasons.map((r) => (
                <div key={r.kind} className="r">
                  <b style={{ flex: 1, fontWeight: 600 }}>{REPLAN_LABELS[r.kind as ReplanKind] ?? r.kind}</b>
                  <div className="bar"><i style={{ width: r.pct + "%", background: "var(--navy2)" }} /></div>
                  <span className="mono" style={{ width: 40, textAlign: "right" }}>{r.pct}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="panel-h"><h3>Saúde da base de lugares</h3><Link className="link" href="/admin/lugares">Ver lugares</Link></div>
            <div className="rank">
              <div className="r"><span style={{ flex: 1 }}>Lugares ativos</span><span className="badge b-navy mono">{n0(s.poisActive)}</span></div>
              <div className="r"><span style={{ flex: 1 }}>Revisados nos últimos 30 dias</span><span className="badge b-sea mono">{s.poisRecentPct}%</span></div>
              <div className="r"><span style={{ flex: 1 }}>Sem revisão há mais de 60 dias (fora das sugestões)</span><span className={"badge mono " + (s.poisStale ? "b-coral" : "b-sea")}>{s.poisStale}</span></div>
              <div className="r"><span style={{ flex: 1 }}>Desativados</span><span className="badge b-grey mono">{s.poisInactive}</span></div>
            </div>
          </div>
        </div>
        {s.requests.length > 0 && (
          <div className="panel">
            <div className="panel-h"><h3>Destinos pedidos e ainda sem cobertura</h3><Link className="link" href="/admin/destinos">Ver destinos</Link></div>
            <div className="rank">
              {s.requests.map((r) => <div key={r.termo} className="r"><b style={{ flex: 1, fontWeight: 600 }}>{r.termo}</b><span className="mono">{r.c} {r.c === 1 ? "pedido" : "pedidos"}</span></div>)}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
