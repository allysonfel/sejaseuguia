import Icon from "@/components/Icon";

export default function AuthHero({ agency }: { agency: string }) {
  const pts: [number, number, string][] = [[30, 290, "1"], [130, 170, "2"], [250, 130, "3"], [400, 40, "4"]];
  return (
    <div className="auth-hero">
      <svg className="hero-route" viewBox="0 0 430 330">
        <path d="M30 290 C90 250 60 190 130 170 S230 190 250 130 S330 60 400 40" fill="none" stroke="#FFB21E" strokeWidth="2.5" strokeDasharray="8 8" />
        {pts.map(([x, y, n]) => (
          <g key={n}>
            <circle cx={x} cy={y} r="16" fill="#101B3B" stroke="#FFB21E" strokeWidth="2.5" />
            <text x={x} y={y + 5} textAnchor="middle" fill="#FFB21E" fontFamily="var(--mono)" fontWeight="700" fontSize="13">{n}</text>
          </g>
        ))}
      </svg>
      <div className="logo">
        <span className="mk"><Icon name="compass" /></span>
        <span>Seja Seu <em>Guia</em></span>
      </div>
      <div>
        <h1>O roteiro que se <i>ajusta</i> a você, até no meio da viagem.</h1>
        <p>Conte como você gosta de viajar. A gente organiza os dias, encurta os deslocamentos e reorganiza tudo quando os planos mudam.</p>
      </div>
      <div style={{ color: "#7F8BB0", fontSize: 12.5 }}>Uma plataforma {agency}</div>
    </div>
  );
}
