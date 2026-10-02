"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { api } from "@/lib/client";
import { relTime } from "@/lib/format";
import type { SimMetrics } from "@/lib/simulate";
import { toast } from "@/lib/toast";
import type { Ritmo, Rules } from "@/lib/types";

type Num = "desloc" | "interesse" | "folga" | "raio";
type Bool = "almoco" | "pico" | "chuva" | "auto";

const SLIDERS: [Num, string, string, number, number, string][] = [
  ["desloc", "Evitar deslocamento", "Quanto o motor prioriza lugares próximos entre si e do hotel.", 0, 100, "%"],
  ["interesse", "Aderência ao perfil", "Quanto os interesses do viajante pesam na escolha.", 0, 100, "%"],
  ["folga", "Folga entre atividades", "Margem somada a cada trajeto de transporte.", 0, 40, " min"],
  ["raio", "Raio preferencial do Ponto Zero", "Distância do hotel antes de penalizar a atração.", 1, 20, " km"],
];
const TOGGLES: [Bool, string, string][] = [
  ["almoco", "Reservar janela de almoço", "Uma refeição perto do trajeto, o mais perto possível das 13h"],
  ["pico", "Fugir do horário de pico", "Atrações disputadas vão para a primeira hora do dia"],
  ["chuva", "Plano B para chuva", "No Modo Viagem, oferece trocar o que é ao ar livre quando a previsão indica chuva"],
  ["auto", "Ajustar sozinho durante a viagem", "Pular, atrasar ou ficar mais tempo reorganiza o resto do dia"],
];

const fmt = (v: number, d = 0) => v.toFixed(d).replace(".", ",");
function delta(a: number, b: number, lowerIsBetter = true, pct = true) {
  if (!b && !a) return { t: "0", good: true };
  const diff = pct ? (b ? ((a - b) / b) * 100 : 100) : a - b;
  const t = (diff > 0 ? "+" : "") + fmt(diff) + (pct ? "%" : "");
  return { t, good: lowerIsBetter ? diff <= 0 : diff >= 0 };
}

export default function EngineAdmin({ draft: initial, version: v0, publishedAt: p0 }: { draft: Rules; version: number; publishedAt: string }) {
  const [r, setR] = useState(initial);
  const [version, setVersion] = useState(v0);
  const [publishedAt, setPublishedAt] = useState(p0);
  const [sim, setSim] = useState<{ draft: SimMetrics; published: SimMetrics } | null>(null);
  const [busy, setBusy] = useState(false);
  const first = useRef(true);

  // rascunho salvo sozinho, um pouco depois da última mudança
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => api("/api/admin/engine", { body: { action: "draft", rules: r } }).catch(() => {}), 600);
    return () => clearTimeout(t);
  }, [r]);

  async function publish() {
    setBusy(true);
    try {
      const x = await api<{ version: number; publishedAt: string }>("/api/admin/engine", { body: { action: "publish", rules: r } });
      setVersion(x.version);
      setPublishedAt(x.publishedAt);
      toast("Regras publicadas. Valem para os novos roteiros");
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }
  async function simulate() {
    setBusy(true);
    try {
      setSim(await api("/api/admin/engine", { body: { action: "simulate", rules: r } }));
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <>
      <div className="toolbar" style={{ marginBottom: 14, justifyContent: "flex-end" }}>
        <button className="btn btn-sun btn-sm" onClick={publish} disabled={busy}>Publicar regras</button>
      </div>
      <div className="grid2" style={{ gridTemplateColumns: "1.2fr 1fr" }}>
        <div className="panel">
          <div className="panel-h"><h3>Regras e pesos</h3><span className="badge b-grey">Versão {version} · publicada {relTime(publishedAt)}</span></div>
          {SLIDERS.map(([k, t, s, min, max, unit]) => (
            <div key={k} className="rule">
              <div className="between"><b>{t}</b><span className="rv">{r[k]}{unit}</span></div>
              <small>{s}</small>
              <input type="range" className="range" min={min} max={max} value={r[k]} onChange={(e) => setR({ ...r, [k]: Number(e.target.value) })} />
            </div>
          ))}
          {TOGGLES.map(([k, t, s]) => (
            <div key={k} className="rule between">
              <div><b>{t}</b><small style={{ margin: "2px 0 0" }}>{s}</small></div>
              <button className={"toggle " + (r[k] ? "on" : "")} onClick={() => setR({ ...r, [k]: !r[k] })} aria-label={t} />
            </div>
          ))}
        </div>
        <div>
          <div className="panel">
            <div className="panel-h"><h3>Atividades por dia, por ritmo</h3></div>
            <div className="rank">
              {(["Tranquilo", "Moderado", "Intenso"] as Ritmo[]).map((k) => (
                <div key={k} className="r">
                  <b style={{ flex: 1, fontWeight: 600 }}>{k}</b>
                  <div className="stepper" style={{ height: 38, width: 150 }}>
                    <b className="mono">{r.porRitmo[k]}</b>
                    <button onClick={() => setR({ ...r, porRitmo: { ...r.porRitmo, [k]: Math.max(1, r.porRitmo[k] - 1) } })} aria-label="Menos">-</button>
                    <button onClick={() => setR({ ...r, porRitmo: { ...r.porRitmo, [k]: Math.min(10, r.porRitmo[k] + 1) } })} aria-label="Mais">+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="panel-h">
              <h3>Teste rápido</h3>
              <button className="btn btn-navy btn-sm" onClick={simulate} disabled={busy}><Icon name="refresh" />Rodar simulação</button>
            </div>
            <div className="panel-b">
              <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
                Monta de novo as últimas viagens com estas regras e compara com a versão publicada.
              </p>
              {sim && sim.draft.trips === 0 && <p className="muted" style={{ fontSize: 13 }}>Ainda não há viagens para simular.</p>}
              {sim && sim.draft.trips > 0 && (() => {
                const rows: [string, string, { t: string; good: boolean }][] = [
                  ["Deslocamento médio por dia", fmt(sim.draft.moveDay) + " min", delta(sim.draft.moveDay, sim.published.moveDay)],
                  ["Atividades por dia", fmt(sim.draft.actsDay, 1), delta(sim.draft.actsDay, sim.published.actsDay, false)],
                  ["Conflitos de horário", String(sim.draft.conflicts), delta(sim.draft.conflicts, sim.published.conflicts, true, false)],
                  ["Dias acima de 8 km a pé", String(sim.draft.longWalkDays), delta(sim.draft.longWalkDays, sim.published.longWalkDays, true, false)],
                ];
                return (
                  <>
                    {rows.map(([l, v, d]) => (
                      <div key={l} className="between" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                        <span>{l}</span>
                        <span><span className="mono" style={{ marginRight: 8 }}>{v}</span><span className={"badge mono " + (d.good ? "b-sea" : "b-coral")}>{d.t}</span></span>
                      </div>
                    ))}
                    <small className="muted">{sim.draft.trips} viagens simuladas.</small>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
