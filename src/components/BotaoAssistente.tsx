"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import Gui from "@/components/quiz/Gui";

const CHAVE = "ssg-assistente-visto";
// Tempo que o balão "Fale comigo" fica na tela: depois ele some e sobra só o Gui (o balão tampava botões).
const BALAO_MS = 6000;

const ouvir = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};
const visto = () => {
  try { return localStorage.getItem(CHAVE) === "1"; } catch { return false; }
};

// Botão flutuante do assistente: o Gui (mascote do app) com o balão "Fale comigo".
// O balão aparece por alguns segundos em cada tela e para de aparecer depois que a
// pessoa abre o assistente pela primeira vez.
export default function BotaoAssistente({ onClick, style }: { onClick: () => void; style?: React.CSSProperties }) {
  // no servidor conta como visto: o balão não pisca para quem já abriu
  const jaAbriu = useSyncExternalStore(ouvir, visto, () => true);
  const [expirou, setExpirou] = useState(false);
  const [abriuAgora, setAbriuAgora] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setExpirou(true), BALAO_MS);
    return () => clearTimeout(t);
  }, []);
  function abrir() {
    try { localStorage.setItem(CHAVE, "1"); } catch {}
    setAbriuAgora(true);
    onClick();
  }
  const balao = !jaAbriu && !abriuAgora && !expirou;
  return (
    <button className="ai-fab gui-fab" style={style} onClick={abrir} aria-label="Fale com o Gui, seu assistente" title="Fale com o Gui, seu assistente">
      <Gui size={50} />
      {balao && <span className="ai-balao"><b>Fale comigo</b>Seu assistente</span>}
    </button>
  );
}
