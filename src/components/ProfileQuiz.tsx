"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { api } from "@/lib/client";
import { firstName } from "@/lib/format";
import { buildProfile, persona, QUIZ, type QuizAnswers } from "@/lib/quiz";
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

  const total = QUIZ.length;
  const q = step >= 0 && step < total ? QUIZ[step] : null;
  const profile = useMemo(() => buildProfile(answers), [answers]);
  const style = persona(profile);
  const who = firstName(nome.trim() || "viajante");

  const go = (n: number) => {
    setDir(n > step ? "fwd" : "back");
    setErr(null);
    setTapped(null);
    setStep(n);
  };

  function pick(id: string) {
    if (!q || advancing.current) return;
    setTapped(id);
    // Toque curto no celular, como nos apps de quiz (ignorado onde não há suporte).
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(8);
    if (q.multi) {
      const cur = answers[q.id] ?? [];
      setAnswers({ ...answers, [q.id]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
      return;
    }
    setAnswers({ ...answers, [q.id]: [id] });
    // Resposta única: mostra a escolha marcada por um instante e segue sozinho.
    advancing.current = true;
    setTimeout(() => {
      advancing.current = false;
      go(step + 1);
    }, 420);
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
          <span className="qz-badge"><Icon name="spark" />{total} perguntas · 1 minuto</span>
          <h1>{signup ? <>Vamos descobrir seu <i>jeito de viajar</i></> : <>Seu jeito de viajar <i>mudou?</i></>}</h1>
          <p>Responda com o coração. No fim, o app monta roteiros, sugestões e o mapa do seu jeito.</p>
          {signup && (
            <div className="field">
              <label htmlFor="qz-nome">Antes de tudo, como podemos te chamar?</label>
              <input id="qz-nome" className="input" required maxLength={80} placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" autoFocus />
            </div>
          )}
        </div>
        <div>
          <button className="btn btn-sun btn-block" disabled={signup && !nome.trim()}>Começar o quiz<Icon name="right" /></button>
          {signup && <div className="auth-foot qz-foot">Já tem conta? <Link className="link" href="/entrar">Entrar</Link></div>}
        </div>
      </form>
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
          <div className="prog"><i style={{ width: "100%" }} /></div>
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
          <button type="button" className="link row qz-redo" onClick={() => { setAnswers({}); go(0); }}><Icon name="refresh" />Refazer o quiz</button>

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
                <button className="btn btn-sun btn-block" disabled={busy}>Criar conta e planejar viagem</button>
              </>
            ) : (
              <button className="btn btn-sun btn-block" disabled={busy}>Salvar meu perfil</button>
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
    <div className="qz">
      <div className="wz-top">
        <div className="between">
          <button className="icon-btn" onClick={() => go(step - 1)} aria-label="Voltar"><Icon name="back" /></button>
          <span className="muted mono" style={{ fontSize: 12.5 }}>{step + 1} de {total}</span>
        </div>
        <div className="prog"><i style={{ width: ((step + 1) / (total + 1)) * 100 + "%" }} /></div>
      </div>
      <div className={"qz-body qz-" + dir} key={q.id}>
        <h2>{q.title}</h2>
        <p className="muted" style={{ marginBottom: 18 }}>{q.sub}</p>
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
      {q.multi && (
        <div className="wz-foot" style={{ gridTemplateColumns: "1fr" }}>
          <button className="btn btn-sun" onClick={() => go(step + 1)} disabled={sel.length < (q.min ?? 0)}>
            {sel.length === 0 && !q.min ? "Nada disso me incomoda" : <>Continuar{sel.length > 0 && <span className="qz-count" key={sel.length}>{sel.length}</span>}</>}
          </button>
        </div>
      )}
    </div>
  );
}
