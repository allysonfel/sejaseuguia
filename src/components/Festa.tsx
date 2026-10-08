// Comemorações do app, no mesmo estilo do quiz: chuva de confete na tela toda
// (roteiro pronto, dia concluído) e explosão pequena num ponto (atividade concluída).
// Só decoração: some sozinha, não pega toque e fica desligada com "reduzir movimento".

const CORES = ["#FFB21E", "#0E9F8E", "#EE4B55", "#6B4EFF", "#FFFFFF"];

const CHUVA = Array.from({ length: 36 }, (_, i) => ({
  left: ((i * 29) % 100) + "%",
  background: CORES[i % CORES.length],
  animationDelay: ((i * 53) % 900) + "ms",
  animationDuration: 1600 + ((i * 97) % 900) + "ms",
  "--r": ((i * 83) % 720) - 360 + "deg",
} as React.CSSProperties));

const EXPLOSAO = Array.from({ length: 12 }, (_, i) => {
  const ang = (i / 12) * Math.PI * 2, dist = 40 + ((i * 37) % 30);
  return {
    "--x": Math.round(Math.cos(ang) * dist) + "px",
    "--y": Math.round(Math.sin(ang) * dist - 20) + "px",
    "--r": ((i * 67) % 360) + "deg",
    background: CORES[i % CORES.length],
    animationDelay: (i % 3) * 30 + "ms",
  } as React.CSSProperties;
});

export function ChuvaConfete() {
  return <span className="qz-chuva festa-tela" aria-hidden="true">{CHUVA.map((c, i) => <i key={i} style={c} />)}</span>;
}

export function Explosao() {
  return <span className="qz-confetti festa-ponto" aria-hidden="true">{EXPLOSAO.map((c, i) => <i key={i} style={c} />)}</span>;
}
