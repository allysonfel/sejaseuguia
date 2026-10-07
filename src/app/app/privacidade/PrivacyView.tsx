"use client";
import { useState } from "react";
import Icon from "@/components/Icon";
import { api } from "@/lib/client";
import { toast } from "@/lib/toast";
import type { Prefs } from "@/lib/auth";

const ROWS: [keyof Prefs, string, string][] = [
  ["location", "Usar minha localização no app", "Só no Modo Viagem, no Explorar e no O que é?"],
  ["history", "Personalizar sugestões com meu histórico", "Suas avaliações pesam nos próximos roteiros"],
  ["offers", "Receber ofertas de parceiros", "Hotéis, passeios e seguros"],
];

export default function PrivacyView({ prefs: initial, deletePending, consent }: { prefs: Prefs; deletePending: boolean; consent: string | null }) {
  const [prefs, setPrefs] = useState(initial);
  const [pending, setPending] = useState(deletePending);

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
  async function askDelete() {
    if (!confirm("Pedir a exclusão da sua conta? A equipe confirma e apaga suas viagens, avaliações e descobertas.")) return;
    try {
      await api("/api/me/privacy-request", { body: { kind: "delete" } });
      setPending(true);
      toast("Pedido de exclusão registrado");
    } catch (e) {
      toast((e as Error).message);
    }
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
        <div className="box-t">Fotos do O que é esse lugar?</div>
        <p>Quando você tira uma foto para descobrir um lugar, ela é enviada a um serviço de inteligência artificial de outra empresa (Z.ai ou Groq) para reconhecer o que aparece nela. Junto vai só a lista de lugares cadastrados perto de você, não a sua localização exata.</p>
        <p style={{ marginTop: 8 }}>A foto não fica guardada no Seja Seu Guia: ela é usada só para essa resposta. Esses serviços podem usar o que recebem para melhorar os modelos deles, então evite fotografar pessoas, documentos ou qualquer coisa pessoal.</p>
        <p style={{ marginTop: 8 }}>Prefere não enviar fotos? Use o botão Só ver o que está perto de mim: ele usa apenas a localização.</p>
      </div>
      <a className="btn btn-ghost btn-block" href="/api/me/export" download><Icon name="download" />Exportar meus dados</a>
      <button className="btn btn-ghost btn-block" style={{ marginTop: 8, color: "var(--coral)" }} onClick={askDelete} disabled={pending}>
        <Icon name="trash" />{pending ? "Exclusão pedida, aguardando a equipe" : "Excluir minha conta"}
      </button>
      {consent && <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>Consentimento de uso dos dados registrado em {consent}.</p>}
    </div>
  );
}
