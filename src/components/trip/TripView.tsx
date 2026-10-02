"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import TabBar from "@/components/TabBar";
import {
  addPoi, carryOver, carryPending, fillGap, lateAdj, moveItem, rainSwap, removeAt, saveAdj, schedAll, tiredAdj,
  type Ctx, type ReplanResult,
} from "@/lib/engine";
import { shortRange } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { TripAccess } from "@/lib/data";
import type { Poi, Profile, ReplanKind, Reservation, Rules, Trip, TripMember } from "@/lib/types";
import AssistantChat from "./AssistantChat";
import DayTimeline from "./DayTimeline";
import MapTab from "./MapTab";
import PeopleTab, { ShareSheet } from "./PeopleTab";
import ReservationsTab, { AddReservationSheet } from "./ReservationsTab";
import { useTripEditor } from "./useTripEditor";

type Tab = "roteiro" | "mapa" | "reservas" | "pessoas";
export type Banner = { t: string; d: string; ai?: boolean };

type Props = {
  trip: Trip & { access: TripAccess };
  pois: Record<number, Poi>;
  profile: Profile;
  rules: Rules;
  reservations: Reservation[];
  members: TripMember[];
  ownerName: string;
  initialTab: Tab;
  initialDay: number;
  initialBanner: Banner | null;
  shareUrl: string;
};

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
  const [carryOff, setCarryOff] = useState<Record<number, boolean>>({});
  const [reservations, setReservations] = useState(props.reservations);
  const [members, setMembers] = useState(props.members);
  const [sheet, setSheet] = useState<null | "addres" | "share">(null);
  const [chat, setChat] = useState(false);

  const d = sdays[day];

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
    carry() {
      const ids = carryPending(ed.days[day]).filter((k) => !carryOff[k]);
      if (!ids.length) return toast("Marque ao menos uma atividade");
      const r = carryOver(ed.days, day, ids, ctx);
      apply(r, "carry", "Levado para " + sdays[day + 1].label);
      setCarryOff({});
      setDay(day + 1);
    },
  };

  const tabs: [Tab, string][] = [["roteiro", "Roteiro"], ["mapa", "Mapa"], ["reservas", "Reservas"], ["pessoas", "Pessoas"]];

  return (
    <>
      <div className="a-body">
        <div className="trip-head">
          <div className="top">
            <Link className="icon-btn" href="/app" aria-label="Voltar"><Icon name="back" /></Link>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2>{trip.destino}</h2>
              <small>{shortRange(trip.inicio, trip.fim)} · Ponto Zero: {trip.hotel.nome}</small>
            </div>
            <Link className="icon-btn" href={"/app/viagem/" + trip.id + "/modo-viagem"} title="Modo viagem"><Icon name="nav" /></Link>
            <button className="icon-btn" title="Compartilhar" onClick={() => (trip.access === "owner" ? setSheet("share") : setTab("pessoas"))}><Icon name="share" /></button>
          </div>
          <div className="ttabs">
            {tabs.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
          </div>
        </div>

        {(tab === "roteiro" || tab === "mapa") && (
          <div className="days">
            {sdays.map((x, i) => (
              <button key={i} className={"day " + (day === i ? "on" : "")} onClick={() => { setDay(i); setOpen(null); setAlts(null); }}>
                <b>Dia {i + 1}</b><small>{x.label}</small>
              </button>
            ))}
          </div>
        )}
        {banner && (tab === "roteiro" || tab === "mapa") && (
          <div className={"banner" + (banner.ai ? " ai" : "")}>
            <Icon name={banner.ai ? "spark" : "refresh"} />
            <div style={{ flex: 1 }}>
              <b>{banner.t}</b>{banner.d}
              <div className="act">
                {ed.undo && <button onClick={() => { ed.revert(); setBanner(null); setAlts(null); toast("Roteiro restaurado"); }}>Desfazer</button>}
                <button onClick={() => { setBanner(null); ed.clearUndo(); }}>Ok</button>
              </div>
            </div>
          </div>
        )}

        {tab === "roteiro" && d && (
          <DayTimeline
            d={d} next={sdays[day + 1]} ctx={ctx} moeda={trip.moeda} canEdit={canEdit} open={open} setOpen={setOpen}
            alts={alts} carryOff={carryOff} setCarryOff={setCarryOff} actions={actions}
          />
        )}
        {tab === "mapa" && d && <MapTab d={d} hotel={trip.hotel} />}
        {tab === "reservas" && (
          <ReservationsTab
            tripId={trip.id} reservations={reservations} canEdit={canEdit} onAdd={() => setSheet("addres")}
            onDeleted={(rid, days, v) => { setReservations((l) => l.filter((x) => x.id !== rid)); ed.adopt(days, v); }}
          />
        )}
        {tab === "pessoas" && (
          <PeopleTab
            trip={trip} ownerName={props.ownerName} members={members} setMembers={setMembers}
            shareUrl={props.shareUrl} onInvite={() => setSheet("share")}
          />
        )}
        <div style={{ height: 84 }} />
      </div>
      <TabBar />

      {sheet === "addres" && (
        <AddReservationSheet
          trip={trip} pois={Object.values(pois)} onClose={() => setSheet(null)}
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
          ctx={ctx} days={ed.days} dayIdx={day} moeda={trip.moeda} onClose={() => setChat(false)}
          onApply={(preview, kind, label) => {
            ed.commit(preview, kind, "Assistente: " + label);
            setTab("roteiro");
            setOpen(null);
            setAlts(null);
            setBanner({ ai: true, t: "Ajuste feito pelo assistente", d: label + ". O Dia " + (day + 1) + " foi recalculado e validado pelo motor de roteiros." });
            toast("Roteiro do Dia " + (day + 1) + " atualizado");
          }}
        />
      ) : (
        <button className="ai-fab" onClick={() => setChat(true)} title="Assistente da viagem"><Icon name="chatai" /></button>
      ))}
    </>
  );
}
