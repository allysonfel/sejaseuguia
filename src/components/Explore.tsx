"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import TabBar from "@/components/TabBar";
import { useTripEditor } from "@/components/trip/useTripEditor";
import { mapsLink } from "@/lib/client";
import { addPoi, travel, type Ctx } from "@/lib/engine";
import { addDays, dayLabel, priceTxt } from "@/lib/format";
import type { IconName } from "@/lib/icons";
import { toast } from "@/lib/toast";
import type { TripAccess } from "@/lib/data";
import type { Poi, Profile, Rules, Trip } from "@/lib/types";

const LeafletMap = dynamic(() => import("@/components/LeafletMap"), { ssr: false, loading: () => <div className="lmap" /> });

const CATS: [string, string, IconName][] = [["tudo", "Tudo", "compass"], ["comer", "Comer", "fork"], ["ver", "Ver", "star"], ["museus", "Museus", "ticket"], ["ar", "Ao ar livre", "pin"]];
const match = (p: Poi, c: string) =>
  c === "tudo" || (c === "comer" && p.meal) || (c === "ver" && (p.cat === "Atração" || p.cat === "Experiência")) || (c === "museus" && p.cat === "Museu") || (c === "ar" && !p.indoor);
const pinIcon = (p: Poi): IconName => (p.meal ? "fork" : p.cat === "Museu" ? "ticket" : !p.indoor ? "pin" : "star");

type Props = {
  trip: (Trip & { access: TripAccess }) | null;
  pois: Record<number, Poi>;
  profile: Profile;
  rules: Rules;
  center: { lat: number; lng: number };
  dayIdx: number;
  geo: boolean;
};

export default function Explore({ trip, pois, profile, rules, center, dayIdx, geo }: Props) {
  const canEdit = !!trip && trip.access !== "viewer";
  const ed = useTripEditor(trip?.id ?? 0, trip?.days ?? [], trip?.version ?? 0, canEdit);
  const ctx = useMemo<Ctx | null>(() => (trip ? { pois, hotel: trip.hotel, profile, rules, inicio: trip.inicio } : null), [trip, pois, profile, rules]);
  const [cat, setCat] = useState("tudo");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [addDay, setAddDay] = useState(dayIdx);

  useEffect(() => {
    if (!geo || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setMe({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { maximumAge: 60000, timeout: 8000 },
    );
  }, [geo]);

  const dayOf = (k: number) => {
    const i = ed.days.findIndex((d) => d.items.some((x) => x.p === k));
    return i < 0 ? null : i;
  };
  const list = Object.values(pois).filter((p) => match(p, cat) && (!q.trim() || p.nome.toLowerCase().includes(q.trim().toLowerCase())));
  // "você" só aparece se estiver perto do destino; senão a referência é o hotel
  const ref = me && Math.abs(me.lat - center.lat) < 0.5 && Math.abs(me.lng - center.lng) < 0.5 ? me : null;
  const from = ref ?? center;
  const p = sel ? pois[sel] : null;
  const dn = p ? dayOf(p.id) : null;

  function add() {
    if (!p || !ctx || !trip) return;
    const r = addPoi(ed.days, addDay, p.id, ctx);
    ed.commit(r.days, "add", "Adicionou " + p.nome + " ao Dia " + (addDay + 1));
    toast(p.nome + " entrou no Dia " + (addDay + 1) + ", parada " + (r.pos + 1));
  }

  return (
    <>
      <div className="a-body" style={{ overflow: "hidden" }}>
        <div className="explore">
          <LeafletMap
            center={center}
            zoom={13}
            fitKey={cat + q}
            markers={[
              ...list.map((x) => ({
                key: x.id, kind: "pin" as const, lat: x.lat, lng: x.lng, icon: pinIcon(x), title: x.nome,
                cls: (dayOf(x.id) != null ? "in " : "") + (sel === x.id ? "sel" : ""), onClick: () => setSel(x.id),
              })),
              ...(ref ? [{ key: "me", kind: "me" as const, ...ref, title: "Você" }] : []),
              ...(trip ? [{ key: "h", kind: "hotel" as const, ...trip.hotel, title: trip.hotel.nome }] : []),
            ]}
          />
          <div className="ex-top">
            <div className="ex-search"><Icon name="search" /><input placeholder={"Buscar lugares" + (trip ? " em " + trip.destino : "")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <div className="chips">
              {CATS.map(([k, l, ic]) => <button key={k} className={"chip " + (cat === k ? "on" : "")} onClick={() => { setCat(k); setSel(null); }}><Icon name={ic} />{l}</button>)}
            </div>
          </div>
          {p ? (
            <div className="ex-card">
              <div className="between">
                <span className="badge b-grey">{p.cat} · {p.bairro}</span>
                <button onClick={() => setSel(null)} aria-label="Fechar"><Icon name="close" /></button>
              </div>
              <h3 style={{ margin: "8px 0 4px" }}>{p.nome}</h3>
              <div className="muted" style={{ fontSize: 13 }}>
                {p.abre === "00:00" && p.fecha === "23:59" ? "Aberto o dia todo" : "Aberto das " + p.abre + " às " + p.fecha} · {priceTxt(p.preco, trip?.moeda ?? "€")} · {travel(from, p, profile).min} min {travel(from, p, profile).modo} {ref ? "de você" : "do hotel"}
              </div>
              {p.tip && <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{p.tip}</div>}
              {dn != null && <div style={{ marginTop: 8 }}><span className="badge b-navy">Já está no seu roteiro, Dia {dn + 1}</span></div>}
              {dn == null && canEdit && trip && (
                <select className="input" style={{ marginTop: 10, width: "100%" }} value={addDay} onChange={(e) => setAddDay(Number(e.target.value))}>
                  {ed.days.map((_, i) => <option key={i} value={i}>Dia {i + 1} · {dayLabel(addDays(trip.inicio, i))}</option>)}
                </select>
              )}
              <div className="row" style={{ gap: 8, marginTop: 12 }}>
                <a className="btn btn-navy" style={{ flex: 1 }} href={mapsLink(p, ref)} target="_blank" rel="noreferrer"><Icon name="nav" />Ir até lá</a>
                {dn == null && canEdit && <button className="btn btn-sun" onClick={add}><Icon name="plus" />Roteiro</button>}
                {dn != null && trip && <Link className="btn btn-ghost" href={`/app/viagem/${trip.id}?dia=${dn}`}>Ver dia</Link>}
              </div>
            </div>
          ) : (
            <div className="ex-legend">
              {ref && <span className="row" style={{ gap: 6 }}><span className="mk-me" style={{ width: 12, height: 12, borderWidth: 2, boxShadow: "none" }} />Você</span>}
              {trip && <span className="row" style={{ gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--navy)", display: "inline-block" }} />No seu roteiro</span>}
              <span className="row" style={{ gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: "50%", background: "#fff", border: "2px solid var(--navy)", display: "inline-block" }} />{list.length} lugares</span>
            </div>
          )}
        </div>
      </div>
      <TabBar />
    </>
  );
}
