import { DEFAULT_RULES, type Rules } from "./types";

const clamp = (v: unknown, min: number, max: number, d: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

export function parseRules(b: Partial<Rules> | undefined): Rules {
  const r = b ?? {};
  const pr = (r.porRitmo ?? {}) as Partial<Rules["porRitmo"]>;
  return {
    desloc: clamp(r.desloc, 0, 100, DEFAULT_RULES.desloc),
    interesse: clamp(r.interesse, 0, 100, DEFAULT_RULES.interesse),
    folga: clamp(r.folga, 0, 40, DEFAULT_RULES.folga),
    raio: clamp(r.raio, 1, 30, DEFAULT_RULES.raio),
    almoco: r.almoco !== false,
    pico: r.pico !== false,
    chuva: r.chuva !== false,
    auto: r.auto !== false,
    porRitmo: {
      Tranquilo: clamp(pr.Tranquilo, 1, 8, 3),
      Moderado: clamp(pr.Moderado, 1, 8, 5),
      Intenso: clamp(pr.Intenso, 1, 10, 6),
    },
  };
}
