"use client";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import Icon from "./Icon";

// Assistente em todas as telas do app. No roteiro e no modo viagem quem aparece é o
// assistente da viagem (que mexe no dia); essas telas avisam por useAssistenteDaViagem
// e o geral some enquanto elas estão abertas.

type Msg = { r: "u" | "b"; t: string; ir?: { href: string; nome: string } | null };

const Ocultar = createContext<(v: boolean) => void>(() => {});

/** Chamado pelas telas que têm o próprio assistente (roteiro e modo viagem). */
export function useAssistenteDaViagem(ativo: boolean) {
  const set = useContext(Ocultar);
  useEffect(() => {
    set(ativo);
    return () => set(false);
  }, [ativo, set]);
}

// Telas com o menu de baixo: o botão fica acima dele.
const COM_MENU = /^\/app(\/(perfil|descobrir|explorar|roteiro|modo-viagem)|\/viagem\/\d+(\/avaliar|\/modo-viagem)?)?$/;
const QUICK = ["Como funciona o app?", "Como convido alguém para a viagem?", "Dicas para a minha viagem"];

export default function AssistenteGeral({ children }: { children: React.ReactNode }) {
  const [oculto, setOculto] = useState(false);
  const [aberto, setAberto] = useState(false);
  const path = usePathname();
  return (
    <Ocultar.Provider value={setOculto}>
      {children}
      {!oculto && (aberto
        ? <Chat path={path} onClose={() => setAberto(false)} />
        : <button className="ai-fab" style={COM_MENU.test(path) ? undefined : { bottom: 22 }} onClick={() => setAberto(true)} title="Assistente"><Icon name="chatai" /></button>)}
    </Ocultar.Provider>
  );
}

// A conversa fica guardada enquanto o app está aberto, mesmo trocando de tela.
let guardada: Msg[] | null = null;

function Chat({ path, onClose }: { path: string; onClose: () => void }) {
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>(guardada ?? [
    { r: "b", t: "Oi! Pode me perguntar qualquer coisa: como usar o app, sobre a sua viagem ou dicas do destino. Para mudar o roteiro, abra o Roteiro e me chame por lá." },
  ]);
  const [typing, setTyping] = useState(false);
  const [txt, setTxt] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { guardada = msgs; }, [msgs]);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [msgs, typing]);

  async function ask(q: string) {
    q = q.trim();
    if (!q || typing) return;
    setTxt("");
    const antes = msgs.slice(1).map(({ r, t }) => ({ r, t }));
    setMsgs((m) => [...m, { r: "u", t: q }]);
    setTyping(true);
    let m: Msg = { r: "b", t: "Não consegui responder agora. Confira a internet e tente de novo." };
    try {
      const res = await fetch("/api/assistant/geral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q, caminho: path, conversa: antes }),
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) {
        const j = (await res.json()) as { t: string; ir: Msg["ir"] };
        m = { r: "b", t: j.t, ir: j.ir };
      } else if (res.status === 401) m = { r: "b", t: "Sua sessão expirou. Entre de novo para continuar." };
    } catch { /* sem rede ou demorou */ }
    setMsgs((l) => [...l, m]);
    setTyping(false);
  }

  function ir(href: string) {
    onClose();
    // Mesma tela com outra aba (ex.: Roteiro para Pessoas): recarrega para abrir a aba certa.
    if (href.split("?")[0] === path) window.location.assign(href);
    else router.push(href);
  }

  return (
    <>
      <div className="sheet-bg" onClick={onClose} style={{ zIndex: 41 }} />
      <div className="ai-pop">
        <div className="chat">
          <div className="chat-h">
            <span className="av"><Icon name="chatai" /></span>
            <div style={{ flex: 1 }}>
              <b style={{ fontFamily: "var(--serif)", fontSize: 17 }}>Assistente</b>
              <div><small className="muted">Tira dúvidas do app e da sua viagem</small></div>
            </div>
            <button className="icon-btn" onClick={onClose} aria-label="Fechar"><Icon name="close" /></button>
          </div>
          <div className="msgs" ref={box}>
            {msgs.map((m, i) => (
              <div key={i} className={"msg " + m.r}>
                {m.t}
                {m.ir && m.ir.href !== path && (
                  <div className="apply">
                    <button className="btn btn-sm" style={{ background: "var(--violet)", color: "#fff" }} onClick={() => ir(m.ir!.href)}>Abrir {m.ir.nome}</button>
                  </div>
                )}
              </div>
            ))}
            {typing && <div className="typing"><i /><i /><i /></div>}
          </div>
          <div className="quick">{QUICK.map((q) => <button key={q} className="chip" onClick={() => ask(q)}>{q}</button>)}</div>
          <form className="composer" onSubmit={(e) => { e.preventDefault(); ask(txt); }}>
            <input placeholder="Pergunte o que quiser" value={txt} onChange={(e) => setTxt(e.target.value)} />
            <button aria-label="Enviar"><Icon name="send" /></button>
          </form>
        </div>
      </div>
    </>
  );
}
