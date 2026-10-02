"use client";
import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { api } from "@/lib/client";
import { dayLabel } from "@/lib/format";
import type { IconName } from "@/lib/icons";
import { toast } from "@/lib/toast";
import type { DayPlan, Poi, Reservation, ReservationType, Trip } from "@/lib/types";

export const RES_TYPES: [ReservationType, IconName, string, string][] = [
  ["Voo", "plane", "#E6EAF5", "var(--navy2)"],
  ["Hotel", "bed", "var(--sun-bg)", "#8A5A00"],
  ["Transfer", "car", "var(--violet-bg)", "var(--violet)"],
  ["Restaurante", "fork", "var(--coral-bg)", "var(--coral)"],
  ["Passeio ou ingresso", "ticket", "var(--sea-bg)", "var(--sea-ink)"],
  ["Aluguel de carro", "car", "var(--violet-bg)", "var(--violet)"],
  ["Seguro", "shield", "#EEF0F5", "var(--muted)"],
];
export const resStyle = (t: string) => RES_TYPES.find((x) => x[0] === t) ?? RES_TYPES[4];

export function resInfo(r: Reservation) {
  return [r.data ? dayLabel(r.data) : null, r.hora, r.info].filter(Boolean).join(" · ");
}

type Props = {
  tripId: number;
  reservations: Reservation[];
  canEdit: boolean;
  onAdd: () => void;
  onDeleted: (rid: number, days: DayPlan[], version: number) => void;
};

export default function ReservationsTab({ tripId, reservations, canEdit, onAdd, onDeleted }: Props) {
  async function del(r: Reservation) {
    if (!confirm("Remover a reserva " + r.nome + "?")) return;
    try {
      const x = await api<{ days: DayPlan[]; version: number }>(`/api/trips/${tripId}/reservations/${r.id}`, { method: "DELETE" });
      onDeleted(r.id, x.days, x.version);
      toast("Reserva removida");
    } catch (e) {
      toast((e as Error).message);
    }
  }
  return (
    <div className="pad" style={{ paddingTop: 14 }}>
      <div className="between" style={{ marginBottom: 12 }}>
        <b style={{ fontSize: 15 }}>{reservations.length} {reservations.length === 1 ? "reserva" : "reservas"} desta viagem</b>
        {canEdit && <button className="btn btn-sun btn-sm" onClick={onAdd}><Icon name="plus" />Adicionar</button>}
      </div>
      {reservations.length === 0 && (
        <div className="box"><div className="empty" style={{ padding: "14px 6px" }}><div className="ei"><Icon name="ticket" /></div><b>Nenhuma reserva ainda</b>Voo, hotel, ingressos e restaurantes ficam guardados aqui, com os códigos à mão.</div></div>
      )}
      {reservations.map((r) => {
        const [, ic, bg, fg] = resStyle(r.tipo);
        return (
          <div key={r.id} className="res">
            <span className="ri" style={{ background: bg, color: fg }}><Icon name={ic} /></span>
            <div className="rm">
              <small>{r.tipo}</small>
              <b>{r.nome}</b>
              {resInfo(r) && <small>{resInfo(r)}</small>}
              {r.codigo && <span className="code">{r.codigo}</span>}
            </div>
            {canEdit && <div className="rm-act"><button onClick={() => del(r)} title="Remover" aria-label="Remover reserva"><Icon name="trash" /></button></div>}
          </div>
        );
      })}
      <div className="box" style={{ background: "var(--sea-bg)", borderColor: "#BFE6DF", fontSize: 13, color: "var(--sea-ink)" }}>
        Reservas ligadas a um lugar do destino viram compromissos fixos no roteiro. Voo no último dia faz o roteiro terminar 3 horas antes.
      </div>
    </div>
  );
}

export function AddReservationSheet({ trip, pois, onClose, onSaved }: {
  trip: Trip;
  pois: Poi[];
  onClose: () => void;
  onSaved: (r: Reservation, days: DayPlan[], version: number, note: string) => void;
}) {
  const [tipo, setTipo] = useState<ReservationType>("Passeio ou ingresso");
  const [nome, setNome] = useState("");
  const [data, setData] = useState(trip.inicio);
  const [hora, setHora] = useState("");
  const [codigo, setCodigo] = useState("");
  const [poiId, setPoiId] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sorted = useMemo(() => pois.slice().sort((a, b) => a.nome.localeCompare(b.nome)), [pois]);
  const linkable = tipo === "Passeio ou ingresso" || tipo === "Restaurante";

  function onName(v: string) {
    setNome(v);
    if (!linkable || poiId) return;
    const hit = sorted.find((p) => p.nome.toLowerCase() === v.trim().toLowerCase());
    if (hit) setPoiId(hit.id);
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ reservation: Reservation; days: DayPlan[]; version: number; note: string }>(`/api/trips/${trip.id}/reservations`, {
        body: { tipo, nome, data, hora, codigo, poiId: linkable && poiId ? poiId : null },
      });
      onSaved(r.reservation, r.days, r.version, r.note);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <div className="sheet-bg" onClick={onClose} />
      <div className="sheet">
        <div className="grab" />
        <h3 style={{ fontSize: 22, marginBottom: 14 }}>Nova reserva</h3>
        <div className="chips" style={{ marginBottom: 14 }}>
          {RES_TYPES.map(([t, ic]) => <button key={t} className={"chip " + (tipo === t ? "on" : "")} onClick={() => setTipo(t)}><Icon name={ic} />{t}</button>)}
        </div>
        {err && <div className="err">{err}</div>}
        <div className="field"><label>Nome</label><input className="input" value={nome} onChange={(e) => onName(e.target.value)} placeholder={tipo === "Voo" ? "Ex.: Salvador para Lisboa" : "Ex.: Oceanário de Lisboa"} /></div>
        {linkable && (
          <div className="field">
            <label>Lugar no roteiro (opcional)</label>
            <select className="input full" value={poiId} onChange={(e) => setPoiId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Não está na lista</option>
              {sorted.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
        )}
        <div className="two">
          <div className="field"><label>Data</label><input className="input mono" type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div className="field"><label>Horário</label><input className="input mono" type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></div>
        </div>
        <div className="field"><label>Código ou localizador</label><input className="input mono" value={codigo} onChange={(e) => setCodigo(e.target.value)} /></div>
        <button className="btn btn-sun btn-block" onClick={save} disabled={busy || !nome.trim()}>Salvar e ajustar roteiro</button>
      </div>
    </>
  );
}
