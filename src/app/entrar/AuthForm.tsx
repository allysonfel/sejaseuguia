"use client";
import Link from "next/link";
import { useState } from "react";
import Icon from "@/components/Icon";
import { api } from "@/lib/client";

type Tab = "viajante" | "equipe";
type Mode = "login" | "recover";

export default function AuthForm({ agency, initialTab }: { agency: string; initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const v = tab === "viajante";

  const go = (m: Mode) => { setMode(m); setErr(null); setInfo(null); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === "login") {
        const r = await api<{ redirect: string }>("/api/auth/login", { body: { email, pass, kind: v ? "traveler" : "staff" } });
        window.location.href = r.redirect;
        return;
      }
      await api("/api/auth/recover", { body: { email } });
      setInfo("Se existir uma conta com esse e-mail, enviamos um link para criar uma senha nova.");
      setMode("login");
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }

  if (mode === "recover")
    return (
      <form onSubmit={submit}>
        <button type="button" className="link row" style={{ gap: 4, marginBottom: 16 }} onClick={() => go("login")}><Icon name="back" />Voltar</button>
        <h2>Recuperar senha</h2>
        <p className="sub">Enviamos um link seguro para você criar uma senha nova.</p>
        {err && <div className="err">{err}</div>}
        <div className="field"><label>E-mail</label><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
        <button className="btn btn-navy btn-block" disabled={busy}>Enviar link</button>
      </form>
    );

  return (
    <form onSubmit={submit}>
      <h2>{v ? "Boas-vindas de volta" : "Painel da operação"}</h2>
      <p className="sub">{v ? "Sua próxima viagem já está esperando." : "Acesso da equipe " + agency + "."}</p>
      <div className="seg">
        <button type="button" className={v ? "on" : ""} onClick={() => setTab("viajante")}>Viajante</button>
        <button type="button" className={!v ? "on" : ""} onClick={() => setTab("equipe")}>Equipe</button>
      </div>
      {err && <div className="err">{err}</div>}
      {info && <div className="okmsg">{info}</div>}
      <div className="field"><label>E-mail</label><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
      <div className="field"><label>Senha</label><input className="input" type="password" required value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" /></div>
      <div className="between" style={{ margin: "-4px 0 18px" }}>
        <span />
        <button type="button" className="link" onClick={() => go("recover")}>Esqueci minha senha</button>
      </div>
      <button className="btn btn-sun btn-block" disabled={busy}>Entrar</button>
      {v ? (
        <div className="auth-foot">Ainda não tem conta? <Link className="link" href="/cadastro">Criar conta grátis</Link></div>
      ) : (
        <div className="auth-foot">Cada pessoa da equipe vê só o que o perfil dela permite.</div>
      )}
    </form>
  );
}
