"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import TabBar from "@/components/TabBar";
import { mapsLink } from "@/lib/client";
import { rainSwap, sched, skipItem, stayLonger, type Ctx } from "@/lib/engine";
import { hm, km1 } from "@/lib/format";
import type { TripAccess } from "@/lib/data";
import type { Poi, Profile, Rules, Trip } from "@/lib/types";
import AssistantChat from "./AssistantChat";
import { useTripEditor } from "./useTripEditor";

type Weather = { temp: number; txt: string; rainSoon: boolean };

// Códigos WMO usados pela Open-Meteo.
function wmo(c: number): string {
  if (c === 0) return "céu limpo";
  if (c <= 2) return "parcialmente nublado";
  if (c === 3) return "nublado";
  if (c <= 48) return "neblina";
  if (c <= 57) return "garoa";
  if (c <= 67) return "chuva";
  if (c <= 77) return "neve";
  if (c <= 82) return "pancadas de chuva";
  return "tempestade";
}

type Props = {
  trip: Trip & { access: TripAccess };
  pois: Record<number, Poi>;
  profile: Profile;
  rules: Rules;
  live: boolean;
  dayIdx: number;
  note: string | null;
  center: { lat: number; lng: number };
};

export default function TravelMode({ trip, pois, profile, rules, live, dayIdx, note, center }: Props) {
  const canEdit = trip.access !== "viewer";
  const ed = useTripEditor(trip.id, trip.days, trip.version, canEdit);
  const ctx = useMemo<Ctx>(() => ({ pois, hotel: trip.hotel, profile, rules, inicio: trip.inicio }), [pois, trip.hotel, profile, rules, trip.inicio]);
  const idx = Math.min(dayIdx, ed.days.length - 1);
  const d = useMemo(() => sched(ed.days[idx], idx, ctx), [ed.days, idx, ctx]);
  const [banner, setBanner] = useState<string | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [chat, setChat] = useState(false);

  // relógio só no navegador (evita diferença entre o HTML do servidor e o do cliente)
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 30000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, []);

  useEffect(() => {
    const p = new URLSearchParams({
      latitude: String(center.lat), longitude: String(center.lng), current: "temperature_2m,weather_code",
      hourly: "precipitation_probability", forecast_hours: "6", timezone: "auto",
    });
    fetch("https://api.open-meteo.com/v1/forecast?" + p)
      .then((r) => r.json())
      .then((j) => setWeather({
        temp: Math.round(j.current.temperature_2m),
        txt: wmo(j.current.weather_code),
        rainSoon: (j.hourly?.precipitation_probability ?? []).some((v: number) => v >= 60),
      }))
      .catch(() => {});
  }, [center.lat, center.lng]);

  const k = d.items.findIndex((it) => !it.done);
  const allDone = d.items.length > 0 && k < 0;
  const cur = k >= 0 ? d.items[k] : null;
  const nx = k >= 0 ? d.items[k + 1] : undefined;
  const af = k >= 0 ? d.items[k + 2] : undefined;
  const nowMin = now ? now.getHours() * 60 + now.getMinutes() : null;
  const clock = live && nowMin != null ? hm(nowMin) : cur ? hm(cur.ini) : hm(d.end);
  const prog = cur ? (live && nowMin != null ? Math.min(1, Math.max(0, (nowMin - cur.ini) / (cur.fim - cur.ini))) : 0.4) : 0;
  const hasOutdoor = d.items.some((it) => !it.done && !it.poi.indoor && !it.fixed);

  function markDone() {
    if (k < 0) return;
    const next = JSON.parse(JSON.stringify(ed.days));
    next[idx].items[k].done = true;
    ed.commit(next, null);
  }
  function longer() {
    const r = stayLonger(ed.days, idx, k, ctx);
    ed.commit(r.days, "longer", "Ficou mais tempo em " + cur!.poi.nome);
    setBanner(r.msg);
  }
  function skip() {
    const r = skipItem(ed.days, idx, k + 1, ctx);
    if (!r) return setBanner("A próxima atividade tem reserva e não pode ser pulada.");
    ed.commit(r.days, "skip", "Pulou " + nx!.poi.nome);
    setBanner(r.msg);
  }
  function rain() {
    const r = rainSwap(ed.days, idx, ctx);
    if (r.changed) ed.commit(r.days, "rain", "Plano para chuva no Dia " + (idx + 1));
    setBanner(r.msg);
  }

  return (
    <>
      <div className="a-body">
        <div className="tv">
          <div className="between">
            <div>
              <div style={{ color: "var(--sun)", fontWeight: 800, fontSize: 12.5 }}>Modo viagem · Dia {idx + 1}</div>
              <h2 style={{ fontSize: 26, fontWeight: 600 }}>{trip.destino}, {d.label.split(", ")[1]}</h2>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="mono" style={{ fontSize: 22 }}>{clock}</div>
              {weather && <div className="weather"><Icon name={weather.rainSoon ? "rain" : "compass"} />{weather.temp}°C, {weather.txt}</div>}
            </div>
          </div>
          {note && <div className="viewing">{note}</div>}
          {weather?.rainSoon && hasOutdoor && canEdit && rules.chuva && (
            <div className="banner" style={{ margin: "14px 0 0" }}>
              <Icon name="rain" />
              <div style={{ flex: 1 }}>
                <b>Chuva prevista nas próximas horas</b>Posso trocar o que é ao ar livre por opções cobertas por perto.
                <div className="act"><button onClick={rain}>Trocar agora</button></div>
              </div>
            </div>
          )}
          {banner && (
            <div className="banner" style={{ margin: "14px 0 0" }}>
              <Icon name="refresh" />
              <div style={{ flex: 1 }}><b>Reorganizei o resto do dia</b>{banner}<div className="act"><button onClick={() => setBanner(null)}>Ok</button></div></div>
            </div>
          )}

          {d.items.length === 0 && <div className="now" style={{ marginTop: 18 }}><h3>Dia livre</h3><p style={{ color: "#B7C0DA", marginTop: 6 }}>Nada marcado para hoje. Aproveite ou peça sugestões ao assistente.</p></div>}
          {allDone && <div className="now" style={{ marginTop: 18 }}><h3>Dia concluído</h3><p style={{ color: "#B7C0DA", marginTop: 6 }}>Volta ao hotel: {d.back.min} min {d.back.modo}.</p></div>}

          {cur && (
            <>
              <div className="lbl">AGORA</div>
              <div className="now">
                <div className="row" style={{ gap: 6, color: "#B7C0DA", fontSize: 12.5 }}><Icon name="pin" />{cur.poi.bairro}, {trip.destino}</div>
                <h3 style={{ marginTop: 6 }}>{cur.poi.nome}</h3>
                <div className="pr"><i style={{ width: prog * 100 + "%" }} /></div>
                <div className="between" style={{ fontSize: 12.5, color: "#B7C0DA" }}>
                  <span className="mono">{hm(cur.ini)} às {hm(cur.fim)}</span>
                  <span>{live && nowMin != null ? (nowMin < cur.ini ? "Começa em " + (cur.ini - nowMin) + " min" : "Faltam " + Math.max(0, cur.fim - nowMin) + " min") : (cur.dur ?? cur.poi.dur) + " min de visita"}</span>
                </div>
                {canEdit && (
                  <div className="tv-acts">
                    <button onClick={markDone}><Icon name="check" /> Concluí</button>
                    <button onClick={longer}>Fiquei mais tempo</button>
                  </div>
                )}
              </div>
            </>
          )}
          {nx && (
            <>
              <div className="lbl">PRÓXIMO</div>
              <div className="next">
                <small className="muted">Saia às <b className="mono" style={{ color: "var(--ink)" }}>{hm(nx.ini - nx.tr.min - nx.wait)}</b></small>
                <h3>{nx.poi.nome}</h3>
                {nx.poi.horarioEstimado && <small className="muted" style={{ display: "block", marginTop: -4, marginBottom: 8 }}>Horário estimado ({nx.poi.abre} às {nx.poi.fecha}): confirme antes de ir.</small>}
                <div className="kpis3">
                  <div><small>Chegada</small><b>{hm(nx.ini)}</b></div>
                  <div><small>Distância</small><b>{km1(nx.tr.km)} km</b></div>
                  <div><small>Trajeto</small><b>{nx.tr.min} min</b></div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <a className="btn btn-navy" style={{ flex: 1 }} href={mapsLink(nx.poi, cur?.poi, nx.tr.modo)} target="_blank" rel="noreferrer"><Icon name="nav" />Navegar até lá</a>
                  {canEdit && <button className="btn btn-ghost" onClick={skip}>Pular</button>}
                </div>
              </div>
            </>
          )}
          {af && (
            <>
              <div className="lbl">DEPOIS</div>
              <div className="later">
                <span className="li-ic" style={{ background: "rgba(255,255,255,.08)", color: "var(--sun)" }}><Icon name="clock" /></span>
                <div><b>{af.poi.nome}</b><div style={{ color: "#B7C0DA", fontSize: 12.5 }}>{hm(af.ini)} · {af.poi.bairro}{af.fixed ? " · reservado" : ""}</div></div>
              </div>
            </>
          )}
          {d.items.length > 0 && (
            <>
              <div className="lbl">HOJE</div>
              <div className="today">
                {d.items.map((it, i) => (
                  <div key={i} className={"it " + (it.done ? "done" : i === k ? "cur" : "")}>
                    <span className="ck">{it.done && <Icon name="check" />}</span>
                    <span className="mono" style={{ fontSize: 12.5, color: "#B7C0DA", width: 44 }}>{hm(it.ini)}</span>
                    <span style={{ flex: 1 }}>{it.poi.nome}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="tv-acts" style={{ marginTop: 16 }}>
            <Link href={`/app/viagem/${trip.id}?aba=reservas`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(255,255,255,.08)", color: "#fff", borderRadius: 12, height: 42, fontWeight: 700, fontSize: 13 }}><Icon name="ticket" /> Reservas</Link>
            <Link href={`/app/viagem/${trip.id}?aba=mapa&dia=${idx}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(255,255,255,.08)", color: "#fff", borderRadius: 12, height: 42, fontWeight: 700, fontSize: 13 }}><Icon name="route" /> Mapa do dia</Link>
          </div>
          <div style={{ height: 70 }} />
        </div>
      </div>
      <TabBar />
      {canEdit && (chat ? (
        <AssistantChat
          ctx={ctx} days={ed.days} dayIdx={idx} moeda={trip.moeda} onClose={() => setChat(false)}
          onApply={(preview, kind, label) => { ed.commit(preview, kind, "Assistente: " + label); setBanner(label + ". O motor validou horários e trajetos."); setChat(false); }}
        />
      ) : (
        <button className="ai-fab" onClick={() => setChat(true)} title="Assistente da viagem"><Icon name="chatai" /></button>
      ))}
    </>
  );
}
