"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import Gui from "@/components/quiz/Gui";

const CHAVE = "ssg-assistente-visto";
// O balão aparece uma vez só no aparelho: marcado assim que aparece.
const MOSTRADO = "ssg-assistente-balao-mostrado";
// Tempo que o balão "Fale comigo" fica na tela: depois ele some e sobra só o Gui (o balão tampava botões).
const BALAO_MS = 6000;

// Lido do aparelho uma vez por carregamento da página (gravar a marca não pode esconder o balão no meio).
let jaVistoCache: boolean | null = null;
const jaVisto = () => {
  if (jaVistoCache == null) {
    try { jaVistoCache = localStorage.getItem(CHAVE) === "1" || localStorage.getItem(MOSTRADO) === "1"; } catch { jaVistoCache = false; }
  }
  return jaVistoCache;
};
const ouvir = () => () => {};
// Tela em que o balão apareceu e se ele já acabou (vale para os botões de todas as telas).
let telaDoBalao: string | null = null;
let acabou = false;

// Botão flutuante do assistente: o Gui (mascote do app) com o balão "Fale comigo".
// O balão aparece uma vez só: some em alguns segundos, ao mudar de tela ou ao abrir o assistente.
export default function BotaoAssistente({ onClick, style }: { onClick: () => void; style?: React.CSSProperties }) {
  // no servidor conta como visto: o balão não pisca para quem já viu
  const visto = useSyncExternalStore(ouvir, jaVisto, () => true);
  const path = usePathname();
  const [, setFim] = useState(false);
  useEffect(() => {
    // mudou de tela: o balão acaba (e não volta se a pessoa retornar à primeira tela)
    if (telaDoBalao && path !== telaDoBalao) acabou = true;
    if (visto || acabou) return;
    telaDoBalao ??= path;
    try { localStorage.setItem(MOSTRADO, "1"); } catch {}
    const t = setTimeout(() => { acabou = true; setFim(true); }, BALAO_MS);
    return () => clearTimeout(t);
  }, [visto, path]);
  function abrir() {
    try { localStorage.setItem(CHAVE, "1"); } catch {}
    acabou = true;
    setFim(true);
    onClick();
  }
  const balao = !visto && !acabou && (telaDoBalao ?? path) === path;
  return (
    <button className="ai-fab gui-fab" style={style} onClick={abrir} aria-label="Fale com o Gui, seu assistente" title="Fale com o Gui, seu assistente">
      <Gui size={50} />
      {balao && <span className="ai-balao"><b>Fale comigo</b>Seu assistente</span>}
    </button>
  );
}
