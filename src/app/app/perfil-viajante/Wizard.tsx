"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "@/components/Icon";
import { api } from "@/lib/client";
import { QUIZ } from "@/lib/quiz";
import type { IconName } from "@/lib/icons";
import { toast } from "@/lib/toast";
import type { Profile, Ritmo } from "@/lib/types";

const COMP: [string, IconName][] = [["Sozinho", "user"], ["Casal", "heart"], ["Família com crianças", "family"], ["Amigos ou grupo", "users"], ["Com idosos", "elder"]];
const INT = ["história", "cultura", "gastronomia", "praias", "natureza", "arquitetura", "museus", "compras", "fotografia", "vida noturna", "experiências locais", "luxo", "esportes", "entretenimento", "família"];
const RITMO: [Ritmo, IconName, string][] = [
  ["Tranquilo", "leaf", "Até 3 atividades por dia, com pausas longas"],
  ["Moderado", "map", "4 a 5 atividades, com tempo para respirar"],
  ["Intenso", "bolt", "O máximo que o dia comportar"],
];
const ORC = ["Econômico", "Intermediário", "Premium", "Luxo"];
const MOB = ["Caminhar", "Transporte público", "Carro", "Táxi ou aplicativo", "Acordar cedo", "Atividades noturnas"];
const EVITAR = ["Excesso de caminhada", "Longos deslocamentos", "Filas longas", "Lugares muito turísticos", "Acordar muito cedo", "Atividades caras"];
const STEPS = [
  { t: "Quem vai viajar?", s: "Isso muda o ritmo, as distâncias e o tipo de lugar." },
  { t: "O que faz seus olhos brilharem?", s: "Escolha quantos quiser. Isso pesa na escolha das atrações." },
  { t: "Ritmo e orçamento", s: "Define quantas atividades cabem por dia e a faixa de preço." },
  { t: "Como se locomove e o que evitar?", s: "O motor usa isso para não montar um dia que você não curtiria." },
];

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export default function Wizard({ initial, done, first, quizHref }: { initial: Profile; done: string; first: boolean; quizHref: string }) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [p, setP] = useState<Profile>(initial);
  const [busy, setBusy] = useState(false);
  const tog = (k: "int" | "mob" | "evitar", v: string) =>
    setP((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));

  async function next() {
    if (i < STEPS.length - 1) return setI(i + 1);
    setBusy(true);
    try {
      await api("/api/me/profile", { method: "PUT", body: p });
      toast("Perfil salvo. Os próximos roteiros já usam ele");
      router.push(done);
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="wz-top">
        <div className="between">
          {i ? (
            <button className="icon-btn" onClick={() => setI(i - 1)} aria-label="Voltar"><Icon name="back" /></button>
          ) : (
            <button className="icon-btn" onClick={() => router.push(first ? "/app" : done)} aria-label="Fechar"><Icon name="close" /></button>
          )}
          <span className="muted mono" style={{ fontSize: 12.5 }}>{i + 1} de {STEPS.length}</span>
        </div>
        <div className="prog"><i style={{ width: ((i + 1) / STEPS.length) * 100 + "%" }} /></div>
      </div>
      <div className="wz" style={{ flex: 1, overflow: "auto", padding: "0 18px 20px" }}>
        <h2>{STEPS[i].t}</h2>
        <p className="muted" style={{ marginBottom: 18 }}>{STEPS[i].s}</p>
        {i === 0 && (
          <Link className="disc-card" href={quizHref} style={{ marginBottom: 16 }}>
            <span className="dc-ic"><Icon name="spark" /></span>
            <span style={{ flex: 1 }}><b>Prefere responder um quiz?</b><small>{QUIZ.length} perguntas rápidas e seu perfil se ajusta sozinho</small></span>
            <Icon name="right" />
          </Link>
        )}
        {i === 0 && COMP.map(([o, ic]) => (
          <button key={o} className={"opt " + (p.comp === o ? "on" : "")} onClick={() => setP({ ...p, comp: o })}>
            <span className="oi"><Icon name={ic} /></span><span><b>{o}</b></span>
          </button>
        ))}
        {i === 1 && (
          <div className="chips">
            {INT.map((o) => <button key={o} className={"chip " + (p.int.includes(o) ? "on" : "")} onClick={() => tog("int", o)}>{cap(o)}</button>)}
          </div>
        )}
        {i === 2 && (
          <>
            {RITMO.map(([o, ic, d]) => (
              <button key={o} className={"opt " + (p.ritmo === o ? "on" : "")} onClick={() => setP({ ...p, ritmo: o })}>
                <span className="oi"><Icon name={ic} /></span><span><b>{o}</b><small>{d}</small></span>
              </button>
            ))}
            <div className="sec-t" style={{ marginTop: 8 }}>Orçamento</div>
            <div className="chips">
              {ORC.map((o) => <button key={o} className={"chip " + (p.orc === o ? "on" : "")} onClick={() => setP({ ...p, orc: o })}>{o}</button>)}
            </div>
          </>
        )}
        {i === 3 && (
          <>
            <div className="chips">
              {MOB.map((o) => <button key={o} className={"chip " + (p.mob.includes(o) ? "on" : "")} onClick={() => tog("mob", o)}>{o}</button>)}
            </div>
            <div className="sec-t" style={{ marginTop: 18 }}>O que evitar</div>
            <div className="chips">
              {EVITAR.map((o) => <button key={o} className={"chip " + (p.evitar.includes(o) ? "on" : "")} onClick={() => tog("evitar", o)}>{o}</button>)}
            </div>
          </>
        )}
      </div>
      <div className="wz-foot">
        <button className="btn btn-ghost" onClick={next} disabled={busy}>Pular</button>
        <button className="btn btn-sun" onClick={next} disabled={busy || (i === 1 && p.int.length === 0)}>
          {i === STEPS.length - 1 ? "Salvar perfil" : "Continuar"}
        </button>
      </div>
    </div>
  );
}
