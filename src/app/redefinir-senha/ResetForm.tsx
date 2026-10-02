"use client";
import { useState } from "react";
import { api } from "@/lib/client";

export default function ResetForm({ token }: { token: string }) {
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(token ? null : "Link inválido. Peça um novo na tela de login.");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ redirect: string }>("/api/auth/reset", { body: { token, pass } });
      window.location.href = r.redirect;
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <h2>Senha nova</h2>
      <p className="sub">Escolha uma senha com pelo menos 8 caracteres.</p>
      {err && <div className="err">{err}</div>}
      <div className="field"><label>Senha nova</label><input className="input" type="password" required minLength={8} value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" /></div>
      <button className="btn btn-sun btn-block" disabled={busy || !token}>Salvar e entrar</button>
      <div className="auth-foot"><a className="link" href="/entrar">Voltar para o login</a></div>
    </form>
  );
}
