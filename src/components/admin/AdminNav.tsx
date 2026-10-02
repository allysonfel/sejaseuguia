"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import Icon from "@/components/Icon";
import { api } from "@/lib/client";
import type { IconName } from "@/lib/icons";
import type { AdminModule } from "@/lib/types";

const NAV: [AdminModule, string, IconName, string, string?][] = [
  ["overview", "/admin", "grid", "Visão geral"],
  ["travelers", "/admin/viajantes", "users", "Viajantes"],
  ["trips", "/admin/viagens", "route", "Viagens"],
  ["pois", "/admin/lugares", "pin", "Pontos de interesse", "Conteúdo"],
  ["dest", "/admin/destinos", "globe", "Destinos"],
  ["engine", "/admin/motor", "sliders", "Motor de roteiros", "Inteligência"],
  ["team", "/admin/equipe", "shield", "Equipe e LGPD", "Operação"],
];

export default function AdminNav({ mods, agency, me }: { mods: AdminModule[]; agency: string; me: { nome: string; role: string; ini: string } }) {
  const path = usePathname();
  const items = NAV.filter((n) => mods.includes(n[0]));
  const on = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  async function logout() {
    const r = await api<{ redirect: string }>("/api/auth/logout", { body: {} });
    window.location.href = r.redirect;
  }
  return (
    <>
      <aside className="side">
        <div className="logo"><span className="mk"><Icon name="compass" /></span><span>Seja Seu <em>Guia</em></span></div>
        <div className="org">{agency}</div>
        <nav>
          {items.map(([k, href, ic, label, grp]) => (
            <Fragment key={k}>
              {grp && <div className="grp">{grp}</div>}
              <Link href={href} className={"nv " + (on(href) ? "on" : "")}><Icon name={ic} />{label}</Link>
            </Fragment>
          ))}
        </nav>
        <div className="me">
          <div className="av">{me.ini}</div>
          <div style={{ flex: 1, minWidth: 0 }}><b>{me.nome}</b><small>{me.role}</small></div>
          <button onClick={logout} title="Sair" aria-label="Sair" style={{ color: "#B7C0DA" }}><Icon name="logout" /></button>
        </div>
      </aside>
      <div className="mob-nav">
        {items.map(([k, href, ic, label]) => <Link key={k} href={href} className={on(href) ? "on" : ""}><Icon name={ic} />{label}</Link>)}
        <button onClick={logout}><Icon name="logout" />Sair</button>
      </div>
    </>
  );
}
