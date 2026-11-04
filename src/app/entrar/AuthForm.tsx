"use client";
import Link from "next/link";
import { useState } from "react";
import Icon from "@/components/Icon";
import { api } from "@/lib/client";

type Mode = "login" | "recover";

// Um login só: o servidor vê se a conta é de viajante ou da equipe e manda para o lugar certo.
export default function AuthForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const go = (m: Mode) => { setMode(m); setErr(null); setInfo(null); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === "login") {
        const r = await api<{ redirect: string }>("/api/auth/login", { body: { email, pass } });
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
      <h2>Boas-vindas de volta</h2>
      <p className="sub">Sua próxima viagem já está esperando.</p>
      {err && <div className="err">{err}</div>}
      {info && <div className="okmsg">{info}</div>}
      <div className="field"><label>E-mail</label><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
      <div className="field"><label>Senha</label><input className="input" type="password" required value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" /></div>
      <div className="between" style={{ margin: "-4px 0 18px" }}>
        <span />
        <button type="button" className="link" onClick={() => go("recover")}>Esqueci minha senha</button>
      </div>
      <button className="btn btn-sun btn-block" disabled={busy}>Entrar</button>
      <div className="auth-foot">Ainda não tem conta? <Link className="link" href="/cadastro">Criar conta grátis</Link></div>
    </form>
  );
}
