// Ilustração de cidade (pôr do sol + silhueta) nas cores do destino.
export default function TripArt({ h = 150, c1 = "#FFB21E", c2 = "#F7845E", id = "sky" }: { h?: number; c1?: string; c2?: string; id?: string }) {
  const y = (f: number) => h * f;
  const skyline = [
    [0, .72], [30, .6], [55, .64], [70, .5], [78, .5], [86, .36], [94, .5], [120, .52], [150, .46], [175, .55],
    [210, .5], [240, .58], [270, .54], [300, .62], [340, .56], [400, .64],
  ].map(([x, f]) => `L${x} ${y(f)}`).join(" ");
  return (
    <svg viewBox={`0 0 400 ${h}`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c1} />
          <stop offset=".55" stopColor={c2} />
          <stop offset="1" stopColor="#2A3C70" />
        </linearGradient>
      </defs>
      <rect width="400" height={h} fill={`url(#${id})`} />
      <circle cx="300" cy={y(.42)} r="30" fill="#FFE3A3" opacity=".9" />
      <path d={`M0 ${y(.72)} ${skyline} L400 ${h} L0 ${h}z`} fill="#101B3B" />
      <path d={`M0 ${y(.86)} C80 ${y(.82)} 160 ${y(.9)} 240 ${y(.85)} S360 ${y(.82)} 400 ${y(.86)} L400 ${h} L0 ${h}z`} fill="#1B2A55" />
      <path d={`M40 ${y(.9)}h60M180 ${y(.93)}h80M300 ${y(.9)}h50`} stroke={c1} strokeWidth="2" opacity=".5" />
    </svg>
  );
}
