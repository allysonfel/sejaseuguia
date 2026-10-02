"use client";
import Link from "next/link";
import { useState } from "react";
import Icon from "./Icon";
import type { Notif } from "@/lib/notifications";

export default function AppHeader({ title, sub, back, avatar, notifs }: { title: string; sub: string; back?: string; avatar?: string | null; notifs?: Notif[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="a-head">
        {back && <Link className="icon-btn" href={back} aria-label="Voltar"><Icon name="back" /></Link>}
        <div className="t" style={{ flex: 1 }}>
          <small>{sub}</small>
          <b>{title}</b>
        </div>
        <Link className="icon-btn av-btn" href="/app/perfil" title="Meu perfil">
          {avatar ? <img src={avatar} alt="" /> : <Icon name="user" />}
        </Link>
        {notifs && (
          <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Notificações">
            <Icon name="bell" />
            {notifs.length > 0 && <span className="pip" />}
          </button>
        )}
      </div>
      {open && notifs && (
        <>
          <div className="sheet-bg" onClick={() => setOpen(false)} />
          <div className="sheet">
            <div className="grab" />
            <h3 style={{ fontSize: 22, marginBottom: 8 }}>Notificações</h3>
            {notifs.length === 0 && <div className="empty"><b>Tudo em dia</b>Avisos de reservas, mudanças no roteiro e convites aparecem aqui.</div>}
            {notifs.map((n, i) => {
              const inner = (
                <>
                  <span className="li-ic"><Icon name={n.ic} /></span>
                  <div className="li-m"><b>{n.t}</b><small>{n.d}</small></div>
                </>
              );
              return n.href ? (
                <Link key={i} className="li" href={n.href} onClick={() => setOpen(false)}>{inner}</Link>
              ) : (
                <div key={i} className="li">{inner}</div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
