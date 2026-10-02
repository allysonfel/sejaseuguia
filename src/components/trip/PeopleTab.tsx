"use client";
import { useState } from "react";
import Icon from "@/components/Icon";
import { api } from "@/lib/client";
import { initials } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { TripAccess } from "@/lib/data";
import type { Trip, TripMember } from "@/lib/types";

const COLORS = ["var(--sea)", "var(--violet)", "var(--coral)", "var(--navy3)", "#B07A00"];

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Link copiado");
  } catch {
    prompt("Copie o link:", text);
  }
}

type Props = {
  trip: Trip & { access: TripAccess };
  ownerName: string;
  members: TripMember[];
  setMembers: (m: TripMember[]) => void;
  shareUrl: string;
  onInvite: () => void;
};

export default function PeopleTab({ trip, ownerName, members, setMembers, shareUrl, onInvite }: Props) {
  const owner = trip.access === "owner";
  const [pub, setPub] = useState(trip.sharePublic);
  const [hide, setHide] = useState(trip.hideRes);

  async function patch(body: { sharePublic?: boolean; hideRes?: boolean }) {
    try {
      const r = await api<{ sharePublic: boolean; hideRes: boolean }>(`/api/trips/${trip.id}`, { method: "PATCH", body });
      setPub(r.sharePublic);
      setHide(r.hideRes);
    } catch (e) {
      toast((e as Error).message);
    }
  }
  async function remove(m: TripMember) {
    if (!confirm("Tirar " + (m.nome ?? m.email) + " da viagem?")) return;
    try {
      setMembers((await api<{ members: TripMember[] }>(`/api/trips/${trip.id}/members/${m.id}`, { method: "DELETE" })).members);
    } catch (e) {
      toast((e as Error).message);
    }
  }
  async function delTrip() {
    if (!confirm("Excluir a viagem para " + trip.destino + "? O roteiro e as reservas somem para todos.")) return;
    try {
      const r = await api<{ redirect: string }>(`/api/trips/${trip.id}`, { method: "DELETE" });
      window.location.href = r.redirect;
    } catch (e) {
      toast((e as Error).message);
    }
  }

  return (
    <div className="pad" style={{ paddingTop: 14 }}>
      <div className="box">
        <div className="box-t">Quem está na viagem</div>
        <div className="li">
          <span className="people"><span style={{ background: "var(--navy)" }}>{initials(ownerName)}</span></span>
          <div className="li-m"><b>{ownerName}</b><small>Organizador</small></div>
        </div>
        {members.map((m, i) => (
          <div key={m.id} className="li">
            <span className="people"><span style={{ background: COLORS[i % COLORS.length] }}>{initials(m.nome ?? m.email)}</span></span>
            <div className="li-m">
              <b>{m.nome ?? m.email}</b>
              <small>{m.role === "editor" ? "Pode editar" : "Só visualizar"}{m.userId ? "" : " · convite pendente"}</small>
            </div>
            {owner && <button className="icon-btn" onClick={() => remove(m)} title="Remover" aria-label="Remover pessoa"><Icon name="trash" /></button>}
          </div>
        ))}
        {owner && <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={onInvite}><Icon name="plus" />Convidar pessoa</button>}
      </div>

      <div className="box">
        <div className="box-t">Link do roteiro</div>
        <div className="row" style={{ background: "var(--bg)", borderRadius: 12, padding: "10px 12px" }}>
          <span className="mono" style={{ flex: 1, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shareUrl.replace(/^https?:\/\//, "")}</span>
          <button onClick={() => copy(shareUrl)} aria-label="Copiar link"><Icon name="link" /></button>
        </div>
        <div className="set-row">
          <div><b>Quem tem o link pode ver</b><small>{pub ? "Sem precisar de conta" : "Desligado: o link não abre"}</small></div>
          <button className={"toggle " + (pub ? "on" : "")} disabled={!owner} onClick={() => patch({ sharePublic: !pub })} aria-label="Link público" />
        </div>
        <div className="set-row">
          <div><b>Esconder reservas no link</b><small>Localizadores e documentos ficam privados</small></div>
          <button className={"toggle " + (hide ? "on" : "")} disabled={!owner} onClick={() => patch({ hideRes: !hide })} aria-label="Esconder reservas" />
        </div>
        {!owner && <small className="muted">Só quem organiza a viagem muda essas opções.</small>}
      </div>
      {owner && <button className="btn btn-ghost btn-block" style={{ color: "var(--coral)" }} onClick={delTrip}><Icon name="trash" />Excluir viagem</button>}
    </div>
  );
}

export function ShareSheet({ tripId, shareUrl, onClose, onMembers }: { tripId: number; shareUrl: string; onClose: () => void; onMembers: (m: TripMember[]) => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    try {
      onMembers((await api<{ members: TripMember[] }>(`/api/trips/${tripId}/members`, { body: { email, role } })).members);
      toast("Convite enviado");
      onClose();
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <>
      <div className="sheet-bg" onClick={onClose} />
      <div className="sheet">
        <div className="grab" />
        <h3 style={{ fontSize: 22, marginBottom: 4 }}>Compartilhar viagem</h3>
        <p className="muted" style={{ marginBottom: 14 }}>Quem você convidar entra com o próprio e-mail e vê o roteiro sempre atualizado.</p>
        <div className="field"><label>E-mail</label><input className="input" type="email" placeholder="marta@email.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="chips" style={{ marginBottom: 16 }}>
          <button className={"chip " + (role === "editor" ? "on" : "")} onClick={() => setRole("editor")}>Pode editar</button>
          <button className={"chip " + (role === "viewer" ? "on" : "")} onClick={() => setRole("viewer")}>Só visualizar</button>
        </div>
        <button className="btn btn-sun btn-block" onClick={send} disabled={busy || !email.includes("@")}>Enviar convite</button>
        <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => copy(shareUrl)}><Icon name="link" />Copiar link</button>
      </div>
    </>
  );
}
