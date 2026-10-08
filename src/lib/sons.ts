"use client";
// Sons curtos do quiz, gerados na hora (Web Audio, sem arquivo para baixar).
// Só tocam depois de um toque da pessoa (regra dos navegadores) e respeitam
// o botão de som do quiz, guardado no aparelho.

const CHAVE = "ssg-quiz-som";
let ctx: AudioContext | null = null;

export function somLigado(): boolean {
  try {
    return localStorage.getItem(CHAVE) !== "0";
  } catch {
    return true;
  }
}

export function guardarSom(ligado: boolean) {
  try {
    localStorage.setItem(CHAVE, ligado ? "1" : "0");
  } catch {}
}

function nota(freq: number, inicio: number, dur: number, vol = 0.12, tipo: OscillatorType = "sine") {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = tipo;
  o.frequency.value = freq;
  const t = ctx.currentTime + inicio;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function tocar(fn: () => void) {
  if (!somLigado()) return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    fn();
  } catch {}
}

/** Toque de uma opção. */
export const somToque = () => tocar(() => nota(660, 0, 0.08, 0.06, "triangle"));

/** Resposta registrada: "plim-plim" subindo. */
export const somAcerto = () => tocar(() => { nota(784, 0, 0.14); nota(1175, 0.09, 0.22); });

/** Fim do quiz: fanfarra curta. */
export const somFesta = () => tocar(() => {
  [523, 659, 784, 1047].forEach((f, i) => nota(f, i * 0.11, 0.3, 0.1, "triangle"));
  nota(1319, 0.48, 0.5, 0.09);
});
