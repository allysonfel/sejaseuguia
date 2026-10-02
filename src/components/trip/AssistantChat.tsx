"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { QUICK, reply, type Reply } from "@/lib/assistant";
import type { Ctx } from "@/lib/engine";
import type { DayPlan, ReplanKind } from "@/lib/types";

type Msg = { r: "u" | "b"; t: string; reply?: Reply; applied?: boolean };

type Props = {
  ctx: Ctx;
  days: DayPlan[];
  dayIdx: number;
  moeda: string;
  onClose: () => void;
  onApply: (preview: DayPlan[], kind: ReplanKind, label: string) => void;
};

// Conversa guardada só enquanto a tela está aberta.
export default function AssistantChat({ ctx, days, dayIdx, moeda, onClose, onApply }: Props) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { r: "b", t: "Oi! Estou acompanhando o Dia " + (dayIdx + 1) + " com você. Posso trocar atividades, ajustar o ritmo, sugerir lugares para comer perto do roteiro ou reorganizar o dia por causa da chuva. É só pedir do seu jeito." },
  ]);
  const [typing, setTyping] = useState(false);
  const [txt, setTxt] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [msgs, typing]);

  function ask(q: string) {
    q = q.trim();
    if (!q || typing) return;
    setTxt("");
    setMsgs((m) => [...m, { r: "u", t: q }]);
    setTyping(true);
    setTimeout(() => {
      const r = reply(q, days, dayIdx, ctx, moeda);
      setMsgs((m) => [...m, { r: "b", t: r.t, reply: r }]);
      setTyping(false);
    }, 450);
  }

  return (
    <>
      <div className="sheet-bg" onClick={onClose} style={{ zIndex: 41 }} />
      <div className="ai-pop">
        <div className="chat">
          <div className="chat-h">
            <span className="av"><Icon name="chatai" /></span>
            <div style={{ flex: 1 }}>
              <b style={{ fontFamily: "var(--serif)", fontSize: 17 }}>Assistente da viagem</b>
              <div><small className="muted">Conhece seu roteiro e ajusta o Dia {dayIdx + 1}</small></div>
            </div>
            <button className="icon-btn" onClick={onClose} aria-label="Fechar"><Icon name="close" /></button>
          </div>
          <div className="msgs" ref={box}>
            {msgs.map((m, i) => (
              <div key={i} className={"msg " + m.r}>
                {m.t}
                {m.reply?.cards && (
                  <div className="cards">{m.reply.cards.map(([a, b], k) => <div key={k}><b>{a}</b>{b}</div>)}</div>
                )}
                {m.reply?.apply && m.reply.preview && !m.applied && (
                  <div className="apply">
                    <button className="btn btn-sm" style={{ background: "var(--violet)", color: "#fff" }} onClick={() => {
                      onApply(m.reply!.preview!, m.reply!.kind ?? "add", m.reply!.apply!);
                      setMsgs((l) => l.map((x, k) => (k === i ? { ...x, applied: true } : x)));
                    }}>{m.reply.apply}</button>
                  </div>
                )}
                {m.applied && <div style={{ marginTop: 6, fontSize: 12, color: "var(--sea-ink)", fontWeight: 700 }}>Aplicado ao roteiro</div>}
              </div>
            ))}
            {typing && <div className="typing"><i /><i /><i /></div>}
          </div>
          <div className="quick">{QUICK.map((q) => <button key={q} className="chip" onClick={() => ask(q)}>{q}</button>)}</div>
          <form className="composer" onSubmit={(e) => { e.preventDefault(); ask(txt); }}>
            <input placeholder="Peça qualquer ajuste na viagem" value={txt} onChange={(e) => setTxt(e.target.value)} />
            <button aria-label="Enviar"><Icon name="send" /></button>
          </form>
        </div>
      </div>
    </>
  );
}
