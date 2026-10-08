// Gui, o mascote do quiz: uma bússola com olhos. Humor muda a animação:
// "idle" balança de leve, "feliz" pula e fecha os olhos sorrindo,
// "festa" comemora no fim do quiz.
export type HumorGui = "idle" | "feliz" | "festa";

export default function Gui({ humor = "idle", size = 64 }: { humor?: HumorGui; size?: number }) {
  const feliz = humor !== "idle";
  return (
    <span className={"gui gui-" + humor} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 64 64">
        {/* sombra no chão */}
        <ellipse className="gui-sombra" cx="32" cy="60" rx="15" ry="3" fill="rgba(16,27,59,.15)" />
        <g className="gui-corpo">
          {/* argola de bússola */}
          <circle className="gui-contorno" cx="32" cy="9" r="4.5" fill="none" stroke="#101B3B" strokeWidth="3" />
          <circle className="gui-contorno" cx="32" cy="33" r="24" fill="#FFB21E" stroke="#101B3B" strokeWidth="3" />
          <circle cx="32" cy="33" r="18" fill="#FFF3D6" />
          {/* agulha da bússola como "topete" */}
          <path d="M32 12 L35.5 20 L32 18.5 L28.5 20 Z" fill="#EE4B55" />
          {/* olhos */}
          {feliz ? (
            <>
              <path d="M22 31 q4 -5 8 0" fill="none" stroke="#101B3B" strokeWidth="3" strokeLinecap="round" />
              <path d="M34 31 q4 -5 8 0" fill="none" stroke="#101B3B" strokeWidth="3" strokeLinecap="round" />
            </>
          ) : (
            <g className="gui-olhos">
              <ellipse cx="26" cy="30" rx="3.2" ry="4.2" fill="#101B3B" />
              <ellipse cx="38" cy="30" rx="3.2" ry="4.2" fill="#101B3B" />
              <circle cx="27.2" cy="28.4" r="1.1" fill="#fff" />
              <circle cx="39.2" cy="28.4" r="1.1" fill="#fff" />
            </g>
          )}
          {/* bochechas e boca */}
          <circle cx="20" cy="38" r="2.6" fill="#F7845E" opacity=".55" />
          <circle cx="44" cy="38" r="2.6" fill="#F7845E" opacity=".55" />
          {feliz ? (
            <path d="M25 38 q7 9 14 0 z" fill="#101B3B" />
          ) : (
            <path d="M27 39 q5 4 10 0" fill="none" stroke="#101B3B" strokeWidth="2.6" strokeLinecap="round" />
          )}
        </g>
      </svg>
    </span>
  );
}
