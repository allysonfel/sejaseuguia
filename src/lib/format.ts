// Formatação usada nas telas (horários, durações, datas em pt-BR).

export const pad = (v: number) => String(v).padStart(2, "0");

/** minutos desde 00:00 -> "HH:MM" */
export const hm = (m: number) => {
  const t = Math.round(m);
  return pad(Math.floor(t / 60) % 24) + ":" + pad(t % 60);
};

/** "HH:MM" -> minutos desde 00:00 */
export const toMin = (s: string) => {
  const [a, b] = s.split(":");
  return Number(a) * 60 + Number(b || 0);
};

export const durTxt = (m: number) =>
  m >= 60 ? Math.floor(m / 60) + "h" + (m % 60 ? pad(m % 60) : "") : m + " min";

export const n0 = (v: number) => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export const km1 = (v: number) => v.toFixed(1).replace(".", ",");

// Faixa de preço como no Google Maps: o símbolo repetido ($ barato, $$ médio, $$$ caro).
// Moeda de um caractere (€, £, ¥, ฿) repete a própria; as outras (R$, US$, kr, SAR) usam "$",
// senão viraria "R$R$".
const FAIXA = ["", "econômico", "moderado", "caro"];
export function priceTxt(preco: number, moeda: string) {
  if (preco <= 0) return "grátis";
  return ([...moeda].length === 1 ? moeda : "$").repeat(preco);
}
/** "$$ (moderado)": para frases onde o símbolo sozinho fica vago. */
export function faixaTxt(preco: number, moeda: string) {
  return preco <= 0 ? "grátis" : priceTxt(preco, moeda) + " (" + FAIXA[Math.min(3, preco)] + ")";
}

const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WD_LONG = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "YYYY-MM-DD" -> Date ao meio-dia UTC (evita pular de dia por fuso). */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export function isoDate(d: Date): string {
  return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
}

export function addDays(iso: string, n: number): string {
  const d = parseDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
}

export function weekday(iso: string): number {
  return parseDate(iso).getUTCDay();
}

/** "Ter, 13/10" */
export function dayLabel(iso: string): string {
  const d = parseDate(iso);
  return WD[d.getUTCDay()] + ", " + pad(d.getUTCDate()) + "/" + pad(d.getUTCMonth() + 1);
}

/** "13/10/2026" */
export function dmy(iso: string): string {
  const d = parseDate(iso);
  return pad(d.getUTCDate()) + "/" + pad(d.getUTCMonth() + 1) + "/" + d.getUTCFullYear();
}

/** "13 a 16 de outubro" / "28 de setembro a 2 de outubro" */
export function rangeTxt(a: string, b: string): string {
  const x = parseDate(a), y = parseDate(b);
  if (x.getUTCMonth() === y.getUTCMonth())
    return x.getUTCDate() + " a " + y.getUTCDate() + " de " + MONTHS[y.getUTCMonth()];
  return x.getUTCDate() + " de " + MONTHS[x.getUTCMonth()] + " a " + y.getUTCDate() + " de " + MONTHS[y.getUTCMonth()];
}

/** "13 a 16/10" */
export function shortRange(a: string, b: string): string {
  const x = parseDate(a), y = parseDate(b);
  return x.getUTCDate() + (x.getUTCMonth() === y.getUTCMonth() ? "" : "/" + pad(x.getUTCMonth() + 1)) + " a " + y.getUTCDate() + "/" + pad(y.getUTCMonth() + 1);
}

/** "Sábado, 26 de setembro" */
export function longToday(iso: string): string {
  const d = parseDate(iso);
  return WD_LONG[d.getUTCDay()] + ", " + d.getUTCDate() + " de " + MONTHS[d.getUTCMonth()];
}

/** Data de hoje no fuso de Brasília, "YYYY-MM-DD". */
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function relTime(iso: string | null): string {
  if (!iso) return "nunca";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 120) return "agora";
  if (s < 3600) return "há " + Math.round(s / 60) + " min";
  if (s < 86400) return "há " + Math.round(s / 3600) + " h";
  const d = Math.round(s / 86400);
  return d === 1 ? "ontem" : "há " + d + " dias";
}

export function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}
