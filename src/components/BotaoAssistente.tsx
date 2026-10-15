"use client";
import { useEffect, useState } from "react";
import Gui from "@/components/quiz/Gui";

const CHAVE = "ssg-assistente-visto";

// Botão flutuante do assistente: o Gui (mascote do app) com o balão "Fale comigo".
// O balão some depois que a pessoa abre o assistente pela primeira vez.
export default function BotaoAssistente({ onClick, style }: { onClick: () => void; style?: React.CSSProperties }) {
  const [balao, setBalao] = useState(false);
  useEffect(() => {
    try { setBalao(localStorage.getItem(CHAVE) !== "1"); } catch { setBalao(true); }
  }, []);
  function abrir() {
    try { localStorage.setItem(CHAVE, "1"); } catch {}
    setBalao(false);
    onClick();
  }
  return (
    <button className="ai-fab gui-fab" style={style} onClick={abrir} aria-label="Fale com o Gui, seu assistente" title="Fale com o Gui, seu assistente">
      <Gui size={50} />
      {balao && <span className="ai-balao"><b>Fale comigo</b>Seu assistente</span>}
    </button>
  );
}
