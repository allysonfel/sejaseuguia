"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ChuvaConfete } from "@/components/Festa";
import Icon from "@/components/Icon";
import BotaoAssistente from "@/components/BotaoAssistente";
import Gui from "@/components/quiz/Gui";
import TabBar from "@/components/TabBar";
import {
  addPoi, carryOver, fillGap, lateAdj, moveItem, rainSwap, removeAt, saveAdj, schedAll, tiredAdj,
  type Ctx, type ReplanResult,
} from "@/lib/engine";
import { hm, shortRange } from "@/lib/format";
import { somFesta } from "@/lib/sons";
import { toast } from "@/lib/toast";
import type { ClimaMes } from "@/lib/clima";
import type { TripAccess } from "@/lib/data";
import type { Poi, Profile, ReplanKind, Reservation, Rules, Trip, TripMember } from "@/lib/types";
import AssistantChat from "./AssistantChat";
import { useAssistenteDaViagem } from "@/components/AssistenteGeral";
import DayTimeline from "./DayTimeline";
import MapTab from "./MapTab";
import PeopleTab, { ShareSheet } from "./PeopleTab";
import ReservationsTab, { AddReservationSheet, type SugestaoReserva } from "./ReservationsTab";
import { useTripEditor } from "./useTripEditor";

type Tab = "roteiro" | "mapa" | "reservas" | "pessoas";
export type Banner = { t: string; d: string; ai?: boolean; festa?: boolean };

type Props = {
  trip: Trip & { access: TripAccess };
  pois: Record<number, Poi>;
  profile: Profile;
  rules: Rules;
  clima: ClimaMes | null;
  reservations: Reservation[];
  members: TripMember[];
  ownerName: string;
  initialTab: Tab;
  initialDay: number;
  initialBanner: Banner | null;
  shareUrl: string;
};

const ouvirStorage = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};
const lerStorage = (k: string) => {
  try { return localStorage.getItem(k); } catch { return null; }
};

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
// Ex.: "Clima em novembro: costuma fazer 5 a 12 °C, com chuva em uns 12 dias"
const climaTxt = (c: ClimaMes) =>
  `Clima em ${MESES[c.mes - 1]}: costuma fazer ${c.tmin} a ${c.tmax} °C, ${c.diasChuva <= 1 ? "quase sem chuva" : `com chuva em uns ${c.diasChuva} dias`}`;

export default function TripView(props: Props) {
  const { trip, pois, profile, rules } = props;
  const canEdit = trip.access !== "viewer";
  const ed = useTripEditor(trip.id, trip.days, trip.version, canEdit);
  const ctx = useMemo<Ctx>(() => ({ pois, hotel: trip.hotel, profile, rules, inicio: trip.inicio }), [pois, trip.hotel, profile, rules, trip.inicio]);
  const sdays = useMemo(() => schedAll(ed.days, ctx), [ed.days, ctx]);
  const [tab, setTab] = useState<Tab>(props.initialTab);
  const [day, setDay] = useState(Math.min(props.initialDay, ed.days.length - 1));
  const [banner, setBanner] = useState<Banner | null>(props.initialBanner);
  const [open, setOpen] = useState<number | null>(null);
  const [alts, setAlts] = useState<number[] | null>(null);
  // Fim do dia: atrações que a pessoa marcou como não realizadas (por id do lugar)
  const [nao, setNao] = useState<Record<number, boolean>>({});
  const [reservations, setReservations] = useState(props.reservations);
  const [members, setMembers] = useState(props.members);
  const [sheet, setSheet] = useState<null | "addres" | "share">(null);
  const [resInicial, setResInicial] = useState<SugestaoReserva | undefined>(undefined);
  const [chat, setChat] = useState(false);
  useAssistenteDaViagem(canEdit);
  // Aviso único quando o roteiro usa lugares importados automaticamente (não revisados pela agência).
  const autos = useMemo(() => ed.days.reduce((n, x) => n + x.items.filter((it) => pois[it.p]?.revisado === false).length, 0), [ed.days, pois]);
  const chaveAviso = "ssg-aviso-auto-" + trip.id;
  // no servidor conta como fechado (sem piscar o aviso para quem já fechou)
  const salvo = useSyncExternalStore(ouvirStorage, () => lerStorage(chaveAviso), () => "1");
  const [fechadoAgora, setFechadoAgora] = useState(false);
  const avisoFechado = fechadoAgora || salvo === "1";
  const fecharAviso = () => {
    setFechadoAgora(true);
    try { localStorage.setItem(chaveAviso, "1"); } catch {}
  };

  const d = sdays[day];

  // Lugares do roteiro que costumam pedir reserva e ainda não têm uma guardada.
  const sugestoesRes = useMemo<SugestaoReserva[]>(() => {
    const ja = new Set(reservations.map((r) => r.poiId).filter(Boolean));
    return sdays.flatMap((s, i) => s.items
      .filter((x) => x.poi.reserva && !x.poi.meal && !x.fixed && !ja.has(x.poi.id))
      .map((x) => ({ poiId: x.poi.id, nome: x.poi.nome, data: s.date, hora: hm(x.ini), dia: i })));
  }, [sdays, reservations]);

  // Animação de troca: aba e dia entram pelo lado de onde a pessoa veio.
  const tabs: [Tab, string][] = [["roteiro", "Roteiro"], ["mapa", "Mapa"], ["reservas", "Reservas"], ["pessoas", "Pessoas"]];
  const [mov, setMov] = useState<"" | "mv-fwd" | "mv-back">("");
  const irTab = (k: Tab) => {
    const de = tabs.findIndex(([x]) => x === tab), para = tabs.findIndex(([x]) => x === k);
    if (de !== para) setMov(para > de ? "mv-fwd" : "mv-back");
    setTab(k);
  };
  const irDia = (i: number) => {
    if (i !== day) setMov(i > day ? "mv-fwd" : "mv-back");
    setDay(i);
  };

  // Roteiro recém-montado: chuva de confete e fanfarra, uma vez.
  const [festa, setFesta] = useState(!!props.initialBanner?.festa);
  useEffect(() => {
    if (!festa) return;
    somFesta();
    // tira o ?novo=1 da barra: recarregar a página não comemora de novo
    window.history.replaceState(null, "", window.location.pathname);
    const t = setTimeout(() => setFesta(false), 2800);
    return () => clearTimeout(t);
  }, [festa]);

  function apply(r: ReplanResult | null, kind: ReplanKind, title: string, activity?: string) {
    if (!r) return;
    ed.commit(r.days, kind, activity ?? title + " no Dia " + (day + 1));
    setOpen(null);
    setAlts(null);
    setBanner({ t: title, d: r.msg });
  }

  const actions = {
    replan(v: "rain" | "tired" | "late" | "save") {
      const fn = { rain: rainSwap, tired: tiredAdj, late: lateAdj, save: saveAdj }[v];
      const title = { rain: "Plano para chuva aplicado", tired: "Ritmo mais leve", late: "Dia reorganizado", save: "Versão econômica" }[v];
      const r = fn(ed.days, day, ctx);
      if (!r.changed) { setBanner({ t: "Nada precisou mudar", d: r.msg }); return; }
      apply(r, v, title);
    },
    move(i: number, dir: number) {
      const r = moveItem(ed.days, day, i, dir, ctx);
      if (r) apply(r, "move", "Ordem alterada");
    },
    remove(i: number) {
      const it = ed.days[day].items[i];
      if (it.fixed) return toast("Essa atividade tem reserva. Remova a reserva primeiro");
      const r = removeAt(ed.days, day, i, ctx);
      apply(r, "remove", "Removi " + pois[it.p].nome, "Removeu " + pois[it.p].nome + " do Dia " + (day + 1));
      setAlts(r.alts);
    },
    addAlt(k: number) {
      const r = addPoi(ed.days, day, k, ctx);
      apply(r, "add", pois[k].nome + " entrou no dia", "Adicionou " + pois[k].nome + " ao Dia " + (day + 1));
    },
    fill(i: number) {
      const r = fillGap(ed.days, day, i, ctx);
      if (!r) return toast("Nada aberto por perto nesse intervalo");
      apply(r, "fill", "Tempo livre aproveitado");
    },
    // Realizada fica salva no roteiro; não realizada fica marcada para poder ir ao dia seguinte.
    feito(i: number, sim: boolean) {
      const it = ed.days[day].items[i];
      if (!!it.done !== sim) {
        const next = JSON.parse(JSON.stringify(ed.days));
        next[day].items[i].done = sim || undefined;
        ed.commit(next, null);
      }
      setNao((n) => ({ ...n, [it.p]: !sim }));
    },
    carry() {
      const ids = ed.days[day].items.filter((it) => nao[it.p] && !it.done && !it.fixed).map((it) => it.p);
      if (!ids.length) return toast("Marque como não realizada o que quer levar");
      const r = carryOver(ed.days, day, ids, ctx);
      apply(r, "carry", "Levado para " + sdays[day + 1].label);
      setNao({});
      irDia(day + 1);
    },
  };

  return (
    <>
      <div className="a-body">
        <div className="trip-head">
          {trip.fotoUrl && (
            <div className="trip-head-foto" style={{ backgroundImage: `url("${trip.fotoUrl}")` }}>
              {trip.fotoCredito && <small className="foto-cred">{trip.fotoCredito}</small>}
            </div>
          )}
          <div className="top">
            <Link className="icon-btn" href="/app" aria-label="Voltar"><Icon name="back" /></Link>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2>{trip.destino}</h2>
              <small>{shortRange(trip.inicio, trip.fim)} · Ponto Zero: {trip.hotel.nome}</small>
              {props.clima && <small className="clima-mes">{climaTxt(props.clima)}</small>}
            </div>
            <button className="icon-btn" title="Compartilhar" aria-label="Compartilhar" onClick={() => (trip.access === "owner" ? setSheet("share") : irTab("pessoas"))}><Icon name="share" /></button>
          </div>
          {/* Modo viagem no dia aberto no roteiro (antes era só um ícone de seta, pouco claro) */}
          <Link className="iniciar-viagem" href={`/app/viagem/${trip.id}/modo-viagem?dia=${day}`}>
            <span className="iv-ic"><Icon name="nav" /></span>
            <span className="iv-t"><b>Iniciar viagem</b><small>Modo viagem do Dia {day + 1}: o que fazer agora, horários e trajetos</small></span>
            <Icon name="right" />
          </Link>
          <div className="ttabs">
            {tabs.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => irTab(k)}>{l}</button>)}
          </div>
        </div>

        {(tab === "roteiro" || tab === "mapa") && (
          <div className="days">
            {sdays.map((x, i) => (
              <button key={i} className={"day " + (day === i ? "on" : "")} onClick={() => { irDia(i); setOpen(null); setAlts(null); }}>
                <b>Dia {i + 1}</b><small>{x.label}</small>
              </button>
            ))}
          </div>
        )}
        {banner && (tab === "roteiro" || tab === "mapa") && (
          <div className={"banner" + (banner.ai ? " ai" : "") + (banner.festa ? " festa" : "")} key={banner.t + banner.d}>
            {banner.festa ? <Gui humor={festa ? "festa" : "feliz"} size={44} /> : <Icon name={banner.ai ? "spark" : "refresh"} />}
            <div style={{ flex: 1 }}>
              <b>{banner.t}</b>{banner.d}
              <div className="act">
                {ed.undo && <button onClick={() => { ed.revert(); setBanner(null); setAlts(null); toast("Roteiro restaurado"); }}>Desfazer</button>}
                <button onClick={() => { setBanner(null); ed.clearUndo(); }}>Ok</button>
              </div>
            </div>
          </div>
        )}

        {autos > 0 && !avisoFechado && (tab === "roteiro" || tab === "mapa") && (
          <div className="aviso-auto" role="note">
            <Icon name="info" />
            <div style={{ flex: 1 }}>
              <b>Roteiro com sugestões automáticas</b>
              {autos} {autos === 1 ? "lugar foi sugerido" : "lugares foram sugeridos"} a partir de dados abertos e a agência ainda não revisou. Os horários podem ser estimados: confirme antes de ir.
            </div>
            <button onClick={fecharAviso} aria-label="Fechar aviso"><Icon name="close" /></button>
          </div>
        )}

        <div key={tab + ":" + (tab === "roteiro" || tab === "mapa" ? day : "")} className={mov}>
        {tab === "roteiro" && d && (
          <DayTimeline
            d={d} next={sdays[day + 1]} ctx={ctx} moeda={trip.moeda} canEdit={canEdit} open={open} setOpen={setOpen}
            alts={alts} nao={nao} actions={actions}
          />
        )}
        {tab === "mapa" && d && <MapTab d={d} hotel={trip.hotel} />}
        {tab === "reservas" && (
          <ReservationsTab
            tripId={trip.id} reservations={reservations} canEdit={canEdit} onAdd={(s) => { setResInicial(s); setSheet("addres"); }}
            sugestoes={sugestoesRes} destino={trip.destino} pais={trip.pais} paisIso={trip.paisIso}
            onDeleted={(rid, days, v) => { setReservations((l) => l.filter((x) => x.id !== rid)); ed.adopt(days, v); }}
          />
        )}
        {tab === "pessoas" && (
          <PeopleTab
            trip={trip} ownerName={props.ownerName} members={members} setMembers={setMembers}
            shareUrl={props.shareUrl} onInvite={() => setSheet("share")}
          />
        )}
        </div>
        <div style={{ height: 84 }} />
      </div>
      <TabBar />
      {festa && <ChuvaConfete />}

      {sheet === "addres" && (
        <AddReservationSheet
          trip={trip} pois={Object.values(pois)} inicial={resInicial} onClose={() => setSheet(null)}
          onSaved={(r, days, v, note) => {
            setReservations((l) => [...l, r].sort((a, b) => (a.data ?? "9").localeCompare(b.data ?? "9") || (a.hora ?? "").localeCompare(b.hora ?? "")));
            ed.adopt(days, v);
            setSheet(null);
            toast(note);
          }}
        />
      )}
      {sheet === "share" && <ShareSheet tripId={trip.id} shareUrl={props.shareUrl} onClose={() => setSheet(null)} onMembers={setMembers} />}

      {canEdit && !sheet && (chat ? (
        <AssistantChat
          ctx={ctx} days={ed.days} dayIdx={day} moeda={trip.moeda} pais={trip} onClose={() => setChat(false)}
          onApply={(preview, kind, label) => {
            ed.commit(preview, kind, "Assistente: " + label);
            irTab("roteiro");
            setOpen(null);
            setAlts(null);
            setBanner({ ai: true, t: "Ajuste feito pelo assistente", d: label + ". O Dia " + (day + 1) + " foi recalculado e validado pelo motor de roteiros." });
            toast("Roteiro do Dia " + (day + 1) + " atualizado");
          }}
        />
      ) : (
        <BotaoAssistente onClick={() => setChat(true)} />
      ))}
    </>
  );
}
