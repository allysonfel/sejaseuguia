"use client";
import { Fragment } from "react";
import Icon from "@/components/Icon";
import { carryPending, whyLines, type Ctx, type Leg, type SDay } from "@/lib/engine";
import { durTxt, hm, km1, priceTxt } from "@/lib/format";
import type { IconName } from "@/lib/icons";

export const legIcon = (l: Leg): IconName => (l.modo === "a pé" ? "walk" : l.modo === "transporte público" ? "metro" : "car");

type Actions = {
  replan: (v: "rain" | "tired" | "late" | "save") => void;
  move: (i: number, dir: number) => void;
  remove: (i: number) => void;
  addAlt: (k: number) => void;
  fill: (i: number) => void;
  carry: () => void;
};

type Props = {
  d: SDay;
  next?: SDay;
  ctx: Ctx;
  moeda: string;
  canEdit: boolean;
  open: number | null;
  setOpen: (v: number | null) => void;
  alts: number[] | null;
  carryOff: Record<number, boolean>;
  setCarryOff: (v: Record<number, boolean>) => void;
  actions: Actions;
};

export default function DayTimeline({ d, next, ctx, moeda, canEdit, open, setOpen, alts, carryOff, setCarryOff, actions }: Props) {
  const pend = canEdit && next ? carryPending({ start: d.start, items: d.items }) : [];
  return (
    <div className={canEdit ? "" : "readonly"}>
      <div className="day-sum">
        <span className="badge b-navy">{d.tema}</span>
        <span className="badge b-grey mono">{hm(d.start)} às {hm(d.end)}</span>
        <span className="badge b-sea">{km1(d.walk)} km a pé</span>
        <span className="badge b-grey">{d.moveMin} min em trânsito</span>
      </div>
      {canEdit && (
        <div className="replan">
          {([["rain", "Está chovendo", "rain"], ["tired", "Estou cansado", "tired"], ["late", "Atrasei 1h", "late"], ["coin", "Quero economizar", "save"]] as const).map(([ic, l, v]) => (
            <button key={v} className="chip" onClick={() => actions.replan(v)}><Icon name={ic} />{l}</button>
          ))}
        </div>
      )}
      <div className="tl">
        <div className="leg"><span /><div className="ln" style={{ paddingTop: 2 }}><Icon name="bed" />Saída do hotel às <b className="mono">{hm(d.start)}</b></div></div>
        {d.items.length === 0 && (
          <div className="empty"><div className="ei"><Icon name="clock" /></div><b>Dia livre</b>Nada marcado. Use Explorar ou o assistente para encaixar algo.</div>
        )}
        {d.items.map((it, i) => {
          const p = it.poi;
          const cascata = { "--i": Math.min(i, 8) } as React.CSSProperties; // paradas entram uma depois da outra
          return (
            <Fragment key={i + ":" + it.p}>
              <div className="leg" style={cascata}>
                <span />
                <div className="ln">
                  <Icon name={legIcon(it.tr)} />
                  <b>{it.tr.min} min</b> {it.tr.modo} · {km1(it.tr.km)} km{it.wait > 10 && it.wait <= 90 ? " · " + durTxt(it.wait) + " livres" : ""}
                </div>
              </div>
              {it.wait > 90 && (
                <div className="leg">
                  <span />
                  <div className="free">
                    <Icon name="clock" />
                    <div style={{ flex: 1 }}><b>{durTxt(it.wait)} de tempo livre</b><small>Descansar no hotel ou encaixar algo por perto antes de {p.nome}</small></div>
                    {canEdit && <button className="btn btn-ghost btn-sm" onClick={() => actions.fill(i)}>Sugerir</button>}
                  </div>
                </div>
              )}
              <div className="stop" style={cascata}>
                <div className="tm">{hm(it.ini)}<small>{hm(it.fim)}</small></div>
                <div style={{ paddingLeft: 24 }}>
                  <div className={"card-stop" + (it.fixed ? " fixed" : "") + (it.warn || it.late ? " warn" : "")}>
                    <span className="num">{i + 1}</span>
                    <div className="acts">
                      <button onClick={() => actions.move(i, -1)} title="Subir" aria-label="Subir"><Icon name="up" /></button>
                      <button onClick={() => actions.move(i, 1)} title="Descer" aria-label="Descer"><Icon name="down" /></button>
                      <button onClick={() => actions.remove(i)} title="Remover" aria-label="Remover"><Icon name="trash" /></button>
                    </div>
                    <button onClick={() => setOpen(open === i ? null : i)} style={{ textAlign: "left", width: "100%" }}>
                      <div className="nm">{p.nome}</div>
                      <div className="sb">{p.cat} · {p.bairro} · {it.dur ?? p.dur} min · {priceTxt(p.preco, moeda)}</div>
                      <div className="tags">
                        {it.done && <span className="badge b-sea"><Icon name="check" />Concluída</span>}
                        {it.fixed && <span className="badge b-sun">Reservado {it.fixed}</span>}
                        {it.warn === "fecha" && <span className="badge b-coral">Fora do horário de funcionamento</span>}
                        {it.warn === "fechado" && <span className="badge b-coral">Fechado neste dia</span>}
                        {it.late && <span className="badge b-coral">Chegada depois do horário reservado</span>}
                        {p.meal && <span className="badge b-grey">Refeição</span>}
                        {p.revisado === false && <span className="badge b-violet" title="Sugerido automaticamente a partir de dados abertos. A agência ainda não revisou este lugar.">Sugestão automática</span>}
                        {p.tags.filter((t) => ctx.profile.int.includes(t)).slice(0, 2).map((t) => <span key={t} className="badge b-navy">{t}</span>)}
                      </div>
                    </button>
                    {open === i && (
                      <>
                        <div className="why">
                          {whyLines(d, i, ctx, moeda).map((w, k) => <div key={k}><Icon name="check" /><span>{w}</span></div>)}
                        </div>
                        {p.horarioEstimado && (
                          <div className="why" style={{ marginTop: 6 }}><div><Icon name="alert" /><span><b>Horário estimado</b> ({p.abre} às {p.fecha}): confirme antes de ir.</span></div></div>
                        )}
                        {p.tip && <div className="why ai" style={{ marginTop: 6 }}><div><Icon name="spark" /><span><b>{p.revisado === false ? "Dica:" : "Dica da curadoria:"}</b> {p.tip}</span></div></div>}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Fragment>
          );
        })}
        <div className="leg">
          <span />
          <div className="ln"><Icon name={legIcon(d.back)} /><b>{d.back.min} min</b> de volta ao hotel · chegada <b className="mono">{hm(d.end)}</b></div>
        </div>
        {d.endFixed && <div className="leg"><span /><div className="ln"><Icon name="plane" />Saída para o aeroporto às <b className="mono">{d.endFixed}</b></div></div>}
      </div>

      {pend.length > 0 && next && (
        <div className="carry">
          <div className="between"><h4>Fim do dia</h4><span className="badge b-sun">{pend.length} {pend.length === 1 ? "pode ficar" : "podem ficar"} para depois</span></div>
          <p className="muted" style={{ fontSize: 12.5, margin: "4px 0 8px" }}>
            Não deu tempo de tudo? Leve o que ficou para o dia seguinte ({next.label}) e o motor reorganiza o dia a partir disso.
          </p>
          {pend.map((k) => {
            const it = d.items.find((x) => x.p === k)!;
            const on = !carryOff[k];
            return (
              <button key={k} className="ci" onClick={() => setCarryOff({ ...carryOff, [k]: on })}>
                <span className={"cb " + (on ? "on" : "")}>{on && <Icon name="check" />}</span>
                <span style={{ flex: 1 }}><b style={{ display: "block", fontSize: 14 }}>{it.poi.nome}</b><small className="muted">Previsto para {hm(it.ini)} · {it.dur ?? it.poi.dur} min</small></span>
              </button>
            );
          })}
          <button className="btn btn-sun btn-block" style={{ marginTop: 10 }} onClick={actions.carry}><Icon name="refresh" />Levar para o dia seguinte</button>
        </div>
      )}

      {alts && alts.length > 0 && (
        <div style={{ padding: "10px 18px 10px" }}>
          <div className="sec-t" style={{ marginTop: 0 }}>Alternativas perto de onde você vai estar</div>
          <div className="alts">
            {alts.map((k) => {
              const p = ctx.pois[k];
              return (
                <button key={k} className="alt" onClick={() => actions.addAlt(k)}>
                  <b>{p.nome}</b><small>{p.cat} · {p.bairro} · {p.dur} min</small>
                  <div style={{ marginTop: 8 }}><span className="badge b-sea"><Icon name="plus" />Adicionar</span></div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
