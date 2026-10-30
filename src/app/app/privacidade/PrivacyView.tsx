"use client";
import { useState } from "react";
import Icon from "@/components/Icon";
import { api } from "@/lib/client";
import { salvarArquivo } from "@/lib/nativo";
import { toast } from "@/lib/toast";
import type { Prefs } from "@/lib/auth";

const ROWS: [keyof Prefs, string, string][] = [
  ["location", "Usar minha localização no app", "Só no Modo Viagem, no Explorar e no O que é?"],
  ["history", "Personalizar sugestões com meu histórico", "Suas avaliações pesam nos próximos roteiros"],
  ["offers", "Receber ofertas de parceiros", "Hotéis, passeios e seguros"],
];

export default function PrivacyView({ prefs: initial, consent }: { prefs: Prefs; consent: string | null }) {
  const [prefs, setPrefs] = useState(initial);
  const [excluindo, setExcluindo] = useState(false);
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function tog(k: keyof Prefs) {
    const next = { ...prefs, [k]: !prefs[k] };
    setPrefs(next);
    try {
      await api("/api/me", { method: "PUT", body: { prefs: { [k]: next[k] } } });
    } catch (e) {
      setPrefs(prefs);
      toast((e as Error).message);
    }
  }
  // Dentro do app o download por link não funciona: baixa e abre a folha de compartilhar do celular.
  async function exportar() {
    try {
      const res = await fetch("/api/me/export");
      if (!res.ok) throw new Error("Não deu para exportar agora. Tente de novo.");
      await salvarArquivo(await res.blob(), "meus-dados-seja-seu-guia.json", "Meus dados do Seja Seu Guia");
    } catch (e) {
      toast((e as Error).message);
    }
  }

  // Exclusão na hora, confirmada com a senha (as lojas exigem exclusão pelo próprio app).
  async function excluir(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await api<{ redirect: string }>("/api/me/excluir", { body: { pass } });
      window.location.href = r.redirect;
      return;
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="pad">
      <div className="box" style={{ padding: "4px 16px" }}>
        {ROWS.map(([k, t, s]) => (
          <div key={k} className="set-row">
            <div><b>{t}</b><small>{s}</small></div>
            <button className={"toggle " + (prefs[k] ? "on" : "")} onClick={() => tog(k)} aria-label={t} />
          </div>
        ))}
      </div>
      <div className="box" style={{ fontSize: 13, lineHeight: 1.6 }}>
        <div className="box-t">Montagem do roteiro</div>
        <p>Para escolher os lugares de cada dia e preparar o roteiro em PDF, o destino, as datas, o hotel e o seu perfil de viajante vão para o Gemini, a inteligência artificial do Google, que pesquisa no Google o que abre nas suas datas. Seu nome, e-mail e reservas não vão junto. É um plano pago, em que o Google não usa esses dados para treinar os modelos dele.</p>
        <div className="box-t" style={{ marginTop: 12 }}>Fotos do O que é esse lugar?</div>
        <p>Quando você tira uma foto para descobrir um lugar, ela vai para o Gemini, do Google, no mesmo plano pago, em que o Google não usa a foto para treinar os modelos dele. Se ele não responder, vai para um serviço gratuito de outra empresa (Z.ai ou Groq). Junto vai só a lista de lugares cadastrados perto de você, não a sua localização exata.</p>
        <p>No assistente da viagem, os pedidos comuns são entendidos no próprio app. Quando ele não entende um pedido, o texto que você escreveu e um resumo do roteiro do dia (lugares, horários e o nome do hotel) vão para um serviço gratuito de inteligência artificial (Groq ou Z.ai), só para interpretar o pedido. Seus dados de cadastro não vão junto. No assistente das outras telas, a pergunta vai junto com o seu primeiro nome, o perfil de viajante e o resumo das suas viagens (destino, datas, hotel e lugares de cada dia), só para responder. Nada disso fica guardado.</p>
        <p style={{ marginTop: 8 }}>A foto não fica guardada no Seja Seu Guia: ela é usada só para essa resposta. Os serviços gratuitos podem usar o que recebem para melhorar os modelos deles, então evite fotografar pessoas, documentos ou qualquer coisa pessoal.</p>
        <p style={{ marginTop: 8 }}>Prefere não enviar fotos? Use o botão Só ver o que está perto de mim: ele usa apenas a localização.</p>
      </div>
      <button className="btn btn-ghost btn-block" onClick={exportar}><Icon name="download" />Exportar meus dados</button>
      {!excluindo ? (
        <button className="btn btn-ghost btn-block" style={{ marginTop: 8, color: "var(--coral)" }} onClick={() => setExcluindo(true)}>
          <Icon name="trash" />Excluir minha conta
        </button>
      ) : (
        <form className="box" style={{ marginTop: 12 }} onSubmit={excluir}>
          <div className="box-t">Excluir minha conta</div>
          <p style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
            Apaga agora a sua conta, o perfil, as viagens que você criou (inclusive para quem você convidou), reservas, avaliações e descobertas. Não dá para desfazer.
          </p>
          {err && <div className="err">{err}</div>}
          <div className="field"><label>Sua senha</label><input className="input" type="password" required value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" /></div>
          <button className="btn btn-block" style={{ background: "var(--coral)", color: "#fff" }} disabled={busy}>{busy ? "Excluindo…" : "Excluir de vez"}</button>
          <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => { setExcluindo(false); setErr(null); setPass(""); }}>Cancelar</button>
        </form>
      )}
      {consent && <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>Consentimento de uso dos dados registrado em {consent}.</p>}
      <p style={{ fontSize: 13, marginTop: 10 }}>
        <a className="link" href="/privacidade">Política de privacidade completa</a> · <a className="link" href="/termos">Termos de uso</a>
      </p>
    </div>
  );
}
