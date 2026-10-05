import type { Profile } from "./types";

const RITMOS = ["Tranquilo", "Moderado", "Intenso"];
const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 40)).slice(0, 20) : []);

export function parseProfile(b: Partial<Profile> | undefined): Profile {
  const p = b ?? {};
  return {
    comp: typeof p.comp === "string" ? p.comp.slice(0, 40) : "Casal",
    int: list(p.int),
    ritmo: RITMOS.includes(p.ritmo as string) ? (p.ritmo as Profile["ritmo"]) : "Moderado",
    orc: typeof p.orc === "string" ? p.orc.slice(0, 20) : "Intermediário",
    mob: list(p.mob),
    evitar: list(p.evitar),
  };
}
