import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import TripArt from "@/components/TripArt";
import { getUserById } from "@/lib/auth";
import { getRules, getTripBySlug, listReservations, poisForTrip } from "@/lib/data";
import { schedAll } from "@/lib/engine";
import { hm, km1, rangeTxt } from "@/lib/format";
import { resIcon } from "@/lib/notifications";
import { DEFAULT_PROFILE } from "@/lib/types";
import PublicMap from "./PublicMap";

export const metadata: Metadata = { robots: { index: false } };

// Roteiro compartilhado: só leitura, sem login, se o organizador deixou o link aberto.
export default async function RoteiroPublico({ params }: { params: Promise<{ slug: string }> }) {
  const trip = await getTripBySlug((await params).slug);
  if (!trip || !trip.sharePublic) notFound();
  const [pois, rules, owner, res] = await Promise.all([poisForTrip(trip), getRules(), getUserById(trip.ownerId), listReservations([trip.id])]);
  const days = schedAll(trip.days, { pois, hotel: trip.hotel, profile: owner?.profile ?? DEFAULT_PROFILE, rules, inicio: trip.inicio });
  return (
    <div className="pub">
      <div className="pub-in">
        <div className="trip-hero" style={{ borderRadius: 0 }}>
          <div className="art"><TripArt h={150} c1={trip.cor1} c2={trip.cor2} /></div>
          <div className="inf">
            <h3>{trip.destino}</h3>
            <div className="meta"><span>{rangeTxt(trip.inicio, trip.fim)}</span><span>Ponto Zero: {trip.hotel.nome}</span><span>Roteiro de {owner?.nome.split(" ")[0] ?? "um viajante"}</span></div>
          </div>
        </div>
        <div className="readonly" style={{ padding: "0 4px" }}>
          {days.map((d) => (
            <div key={d.idx} style={{ marginTop: 18 }}>
              <div className="sec-t" style={{ padding: "0 18px" }}>Dia {d.idx + 1} · {d.label}</div>
              <div className="day-sum">
                <span className="badge b-navy">{d.tema}</span>
                <span className="badge b-grey mono">{hm(d.start)} às {hm(d.end)}</span>
                <span className="badge b-sea">{km1(d.walk)} km a pé</span>
              </div>
              <div className="map-box"><PublicMap hotel={trip.hotel} pts={d.items.map((i) => ({ id: i.poi.id, lat: i.poi.lat, lng: i.poi.lng, nome: i.poi.nome }))} /></div>
              <div className="tl">
                {d.items.map((it, i) => (
                  <div key={i} className="stop" style={{ marginBottom: 10 }}>
                    <div className="tm">{hm(it.ini)}<small>{hm(it.fim)}</small></div>
                    <div style={{ paddingLeft: 24 }}>
                      <div className={"card-stop" + (it.fixed ? " fixed" : "")}>
                        <span className="num">{i + 1}</span>
                        <div className="nm" style={{ paddingRight: 0 }}>{it.poi.nome}</div>
                        <div className="sb">{it.poi.cat} · {it.poi.bairro} · {it.dur ?? it.poi.dur} min · {it.tr.min} min {it.tr.modo} até aqui</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!trip.hideRes && res.length > 0 && (
            <div className="pad">
              <div className="sec-t">Reservas</div>
              {res.map((r) => (
                <div key={r.id} className="res">
                  <span className="ri" style={{ background: "#E6EAF5" }}><Icon name={resIcon(r.tipo)} /></span>
                  <div className="rm"><small>{r.tipo}</small><b>{r.nome}</b><small>{[r.data, r.hora].filter(Boolean).join(" · ")}</small></div>
                </div>
              ))}
            </div>
          )}
          <p className="muted" style={{ textAlign: "center", fontSize: 12.5, padding: "20px 18px" }}>
            Roteiro montado com o Seja Seu Guia. <a className="link" href="/entrar?cadastro=1">Crie o seu</a>
          </p>
        </div>
      </div>
    </div>
  );
}
