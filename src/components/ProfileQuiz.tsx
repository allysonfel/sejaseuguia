"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Icon from "@/components/Icon";
import Gui, { type HumorGui } from "@/components/quiz/Gui";
import { api } from "@/lib/client";
import { firstName } from "@/lib/format";
import { buildProfile, persona, QUIZ, type QuizAnswers } from "@/lib/quiz";
import { guardarSom, somAcerto, somFesta, somLigado, somToque } from "@/lib/sons";
import { toast } from "@/lib/toast";

type Props =
  | { mode: "signup"; agency: string }
  | { mode: "edit"; nome: string; done: string };

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// Confete do resultado: posições fixas (sem aleatório) para o servidor e o navegador desenharem igual.
const CONFETTI_COLORS = ["#FFB21E", "#0E9F8E", "#EE4B55", "#6B4EFF", "#FFFFFF"];
const CONFETTI = Array.from({ length: 16 }, (_, i) => {
  const ang = (i / 16) * Math.PI * 2;
  const dist = 70 + ((i * 37) % 50);
  return {
    "--x": Math.round(Math.cos(ang) * dist) + "px",
    "--y": Math.round(Math.sin(ang) * dist - 30) + "px",
    "--r": ((i * 67) % 360) + "deg",
    background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    animationDelay: (i % 4) * 40 + "ms",
  } as React.CSSProperties;
});

// Chuva de confete da tela "Quiz completo!" (também sem aleatório).
const CHUVA = Array.from({ length: 36 }, (_, i) => ({
  left: ((i * 29) % 100) + "%",
  background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  animationDelay: ((i * 53) % 900) + "ms",
  animationDuration: 1600 + ((i * 97) % 900) + "ms",
  "--r": ((i * 83) % 720) - 360 + "deg",
} as React.CSSProperties));

// Gamificação no estilo Duolingo: uma faixa confirma que a resposta foi salva antes de seguir.
// O que o Gui diz no balão depois da resposta (a faixa de baixo já comemora).
const FALAS_GUI = [
  "Já estou imaginando essa viagem!",
  "Vou lembrar disso no roteiro.",
  "Adorei! Isso muda tudo.",
  "Hmm, tenho ótimas ideias pra você.",
  "Anotei aqui na minha bússola.",
  "Seu roteiro está ganhando forma!",
  "Última peça do quebra-cabeça!",
];

function Alto({ ligado }: { ligado: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      {ligado ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="M17 9l5 6M22 9l-5 6" />}
    </svg>
  );
}

// Conta de 0 até o valor, para os números da tela final.
function Contador({ ate }: { ate: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const passo = (t: number) => {
      const k = Math.min(1, (t - t0) / 900);
      setN(Math.round(ate * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [ate]);
  return <>{n}</>;
}

const semAssinatura = () => () => {};

// Quiz de perfil: no cadastro termina criando a conta; no app, regrava o perfil.
export default function ProfileQuiz(props: Props) {
  const router = useRouter();
  const signup = props.mode === "signup";
  const [step, setStep] = useState(-1); // -1 abertura, 0..n-1 perguntas, n resultado
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [nome, setNome] = useState(signup ? "" : props.nome);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const advancing = useRef(false);
  const [tapped, setTapped] = useState<string | null>(null); // opção recém-tocada: anima o "pop"
  // gamificação
  const [feedback, setFeedback] = useState(false);
  const [humor, setHumor] = useState<HumorGui>("idle");
  const [, recontar] = useState(0);
  // Preferência de som guardada no aparelho (no servidor, considera ligado).
  const som = useSyncExternalStore(semAssinatura, somLigado, () => true);
  const [completo, setCompleto] = useState(true); // no fim: primeiro a comemoração, depois o estilo
  const inicio = useRef(0);
  const [tempo, setTempo] = useState(0);

  const total = QUIZ.length;
  const q = step >= 0 && step < total ? QUIZ[step] : null;
  const profile = useMemo(() => buildProfile(answers), [answers]);
  const style = persona(profile);
  const who = firstName(nome.trim() || "viajante");

  const go = (n: number) => {
    setDir(n > step ? "fwd" : "back");
    setErr(null);
    setTapped(null);
    setFeedback(false);
    setHumor("idle");
    if (n === 0 && !inicio.current) inicio.current = Date.now();
    if (n === total) {
      setTempo(Math.max(1, Math.round((Date.now() - (inicio.current || Date.now())) / 1000)));
      setCompleto(true);
      somFesta();
    }
    setStep(n);
  };

  // Pergunta respondida: som, Gui feliz e a faixa de feedback.
  function comemorar() {
    somAcerto();
    setHumor("feliz");
    setFeedback(true);
  }

  function pick(id: string) {
    if (!q || advancing.current || feedback) return;
    setTapped(id);
    // Toque curto no celular, como nos apps de quiz (ignorado onde não há suporte).
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(8);
    if (q.multi) {
      const cur = answers[q.id] ?? [];
      if (!cur.includes(id)) somToque();
      setAnswers({ ...answers, [q.id]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
      return;
    }
    setAnswers({ ...answers, [q.id]: [id] });
    somToque();
    // Resposta única: marca a escolha e, num instante, sobe a faixa de feedback.
    advancing.current = true;
    setTimeout(() => {
      advancing.current = false;
      comemorar();
    }, 260);
  }

  function trocarSom() {
    guardarSom(!som);
    recontar((n) => n + 1);
  }

  function refazer() {
    setAnswers({});
    inicio.current = 0;
    go(0);
  }

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (signup) {
        const r = await api<{ redirect: string }>("/api/auth/signup", { body: { nome, email, pass, consent, profile } });
        window.location.href = r.redirect;
        return;
      }
      await api("/api/me/profile", { method: "PUT", body: profile });
      toast("Perfil salvo. Os próximos roteiros já usam ele");
      router.push(props.done);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  // ---------------------------------------------------------- abertura
  if (step === -1)
    return (
      <form className="qz-intro" onSubmit={(e) => { e.preventDefault(); go(0); }}>
        <div className="between">
          <div className="logo"><span className="mk"><Icon name="compass" /></span><span>Seja Seu <em>Guia</em></span></div>
          {!signup && <button type="button" className="icon-btn qz-close" onClick={() => router.push(props.done)} aria-label="Fechar"><Icon name="close" /></button>}
        </div>
        <div className="qz-intro-m">
          <div className="qz-intro-gui"><Gui humor="feliz" size={84} /></div>
          <span className="qz-badge"><Icon name="spark" />{total} perguntas · 1 minuto</span>
          <h1>{signup ? <>Vamos descobrir seu <i>jeito de viajar</i></> : <>Seu jeito de viajar <i>mudou?</i></>}</h1>
          <p>Eu sou o Gui. Responda com o coração: no fim o app monta roteiros, sugestões e o mapa do seu jeito.</p>
          {signup && (
            <div className="field">
              <label htmlFor="qz-nome">Antes de tudo, como podemos te chamar?</label>
              <input id="qz-nome" className="input" required maxLength={80} placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" autoFocus />
            </div>
          )}
        </div>
        <div>
          <button className="btn btn-sun btn-block qz-3d" disabled={signup && !nome.trim()}>Começar o quiz<Icon name="right" /></button>
          {signup && <div className="auth-foot qz-foot">Já tem conta? <Link className="link" href="/entrar">Entrar</Link></div>}
        </div>
      </form>
    );

  // ---------------------------------------------------------- quiz completo (comemoração)
  if (!q && completo)
    return (
      <div className="qz qz-fim">
        <span className="qz-chuva" aria-hidden="true">{CHUVA.map((c, i) => <i key={i} style={c} />)}</span>
        <div className="qz-fim-m">
          <Gui humor="festa" size={120} />
          <h2>Quiz completo!</h2>
          <p>{who}, você descobriu seu jeito de viajar.</p>
          <div className="qz-stats">
            <div className="qz-stat s-perg" style={{ "--i": 0 } as React.CSSProperties}><small>Perguntas</small><b><Icon name="check" /><Contador ate={total} /></b></div>
            <div className="qz-stat s-tempo" style={{ "--i": 1 } as React.CSSProperties}><small>Tempo</small><b><Icon name="clock" />{Math.floor(tempo / 60)}:{String(tempo % 60).padStart(2, "0")}</b></div>
          </div>
        </div>
        <button className="btn btn-sun btn-block qz-3d" onClick={() => setCompleto(false)}>Ver meu estilo de viagem<Icon name="right" /></button>
      </div>
    );

  // ---------------------------------------------------------- resultado
  if (!q) {
    const traits = [profile.comp, profile.ritmo, profile.orc, ...profile.int.slice(0, 5).map(cap)];
    return (
      <div className="qz">
        <div className="wz-top">
          <div className="between">
            <button className="icon-btn" onClick={() => go(total - 1)} aria-label="Voltar"><Icon name="back" /></button>
            <span className="muted mono" style={{ fontSize: 12.5 }}>Resultado</span>
          </div>
          <div className="prog qz-prog"><i style={{ width: "100%" }} /></div>
        </div>
        <div className={"qz-body qz-" + dir} key="result">
          <div className="qz-result">
            <span className="qz-confetti" aria-hidden="true">
              {CONFETTI.map((c, i) => <i key={i} style={c} />)}
            </span>
            <span className="qz-res-ic"><Icon name={style.icon} /></span>
            <small>{who}, seu estilo é</small>
            <h2>{style.nome}</h2>
            <p>{style.desc}</p>
            <p className="qz-res-r"><Icon name="clock" />{style.ritmo}</p>
            <div className="chips">{traits.map((t, i) => <span key={t} className="chip" style={{ "--i": i } as React.CSSProperties}>{t}</span>)}</div>
          </div>
          <button type="button" className="link row qz-redo" onClick={refazer}><Icon name="refresh" />Refazer o quiz</button>

          <form onSubmit={finish}>
            {err && <div className="err">{err}</div>}
            {signup ? (
              <>
                <div className="sec-t">Agora é só criar sua conta</div>
                <div className="field"><label>E-mail</label><input className="input" type="email" required placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
                <div className="field"><label>Senha</label><input className="input" type="password" required minLength={8} placeholder="Mínimo de 8 caracteres" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" /></div>
                <label className="row" style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 16, alignItems: "flex-start" }}>
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} required />
                  Li e aceito a política de privacidade e autorizo a {props.agency} a usar meus dados para montar meus roteiros.
                </label>
                <button className="btn btn-sun btn-block qz-3d" disabled={busy}>Criar conta e planejar viagem</button>
              </>
            ) : (
              <button className="btn btn-sun btn-block qz-3d" disabled={busy}>Salvar meu perfil</button>
            )}
          </form>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------- pergunta
  const sel = answers[q.id] ?? [];
  const grid = q.multi && q.options.length > 5;
  return (
    <div className="qz qz-jogo">
      <div className="wz-top qz-top">
        <button className="icon-btn" onClick={() => go(step - 1)} aria-label="Voltar"><Icon name="back" /></button>
        <div className="prog qz-prog" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={step + (feedback ? 1 : 0)} aria-label={`Pergunta ${step + 1} de ${total}`}>
          <i style={{ width: Math.max(6, ((step + (feedback ? 1 : 0)) / total) * 100) + "%" }} />
        </div>
        <button className={"qz-som " + (som ? "" : "off")} onClick={trocarSom} aria-label={som ? "Desligar som" : "Ligar som"} title={som ? "Som ligado" : "Som desligado"}><Alto ligado={som} /></button>
      </div>
      <div className={"qz-body qz-" + dir} key={q.id}>
        <small className="qz-num">Pergunta {step + 1} de {total}</small>
        <h2>{q.title}</h2>
        <div className="qz-fala">
          <Gui humor={humor} size={58} />
          <div className="qz-balao" key={feedback ? "fb" : "q"}>{feedback ? FALAS_GUI[step % FALAS_GUI.length] : q.sub}</div>
        </div>
        <div className={(grid ? "qz-grid " : "qz-list ") + (!q.multi && tapped ? "decided" : "")}>
          {q.options.map((o, i) => {
            const on = sel.includes(o.id);
            return (
              <button key={o.id} type="button" className={"opt qz-opt " + (on ? "on " : "") + (tapped === o.id ? "pop" : "")}
                style={{ "--i": i } as React.CSSProperties} aria-pressed={on} onClick={() => pick(o.id)}>
                <span className="oi"><Icon name={o.icon} /></span>
                <span style={{ flex: 1 }}><b>{o.label}</b>{o.hint && <small>{o.hint}</small>}</span>
                {q.multi && <span className="qz-check"><Icon name="check" /></span>}
              </button>
            );
          })}
        </div>
      </div>
      {q.multi && !feedback && (
        <div className="wz-foot" style={{ gridTemplateColumns: "1fr" }}>
          <button className="btn btn-sun qz-3d" onClick={comemorar} disabled={sel.length < (q.min ?? 0)}>
            {sel.length === 0 && !q.min ? "Nada disso me incomoda" : <>Continuar{sel.length > 0 && <span className="qz-count" key={sel.length}>{sel.length}</span>}</>}
          </button>
        </div>
      )}

      {feedback && (
        <div className="qz-fb" role="status">
          <div className="qz-fb-l">
            <span className="qz-fb-ic"><Icon name="check" /></span>
            <b>Resposta salva</b>
          </div>
          <button className="btn btn-block qz-3d qz-fb-btn" onClick={() => go(step + 1)} autoFocus>{step + 1 === total ? "Finalizar" : "Continuar"}</button>
        </div>
      )}

    </div>
  );
}
