import { isTime, str } from "./api";
import { POI_CATS, POI_SOURCES } from "./types";

export type PoiInput = {
  nome: string; cat: string; bairro: string; lat: number; lng: number; dur: number; abre: string; fecha: string;
  preco: number; reserva: boolean; indoor: boolean; meal: boolean; tags: string[]; closedDays: number[];
  tip: string | null; historia: string | null; curiosidades: string[]; datas: { ano: string; txt: string }[];
  source: string; active: boolean;
};

/** Valida o formulário de lugar do painel. Devolve a mensagem de erro ou os dados limpos. */
export function parsePoi(b: Record<string, unknown>): PoiInput | string {
  const nome = str(b.nome, 120);
  if (!nome) return "Informe o nome do lugar.";
  const cat = POI_CATS.includes(String(b.cat)) ? String(b.cat) : "";
  if (!cat) return "Escolha a categoria.";
  const lat = Number(b.lat), lng = Number(b.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return "Marque o lugar no mapa.";
  const dur = Math.round(Number(b.dur));
  if (!(dur >= 10 && dur <= 600)) return "Duração média entre 10 e 600 minutos.";
  const abre = str(b.abre, 5), fecha = str(b.fecha, 5);
  if (!isTime(abre) || !isTime(fecha)) return "Horários no formato 09:00.";
  const preco = Math.round(Number(b.preco));
  if (!(preco >= 0 && preco <= 3)) return "Faixa de preço inválida.";
  const lines = (v: unknown) => (typeof v === "string" ? v : "").split("\n").map((x) => x.trim()).filter(Boolean);
  return {
    nome, cat, bairro: str(b.bairro, 60), lat, lng, dur, abre, fecha, preco,
    reserva: b.reserva === true, indoor: b.indoor !== false, meal: b.meal === true,
    tags: (typeof b.tags === "string" ? b.tags : "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 10),
    closedDays: Array.isArray(b.closedDays) ? [...new Set(b.closedDays.map(Number).filter((d) => d >= 0 && d <= 6))] : [],
    tip: str(b.tip, 300) || null,
    historia: str(b.historia, 2000) || null,
    curiosidades: lines(b.curiosidades).slice(0, 8).map((x) => x.slice(0, 300)),
    datas: lines(b.datas).slice(0, 8).map((x) => {
      const m = x.match(/^(\S+)\s*[-–:]\s*(.+)$/);
      return m ? { ano: m[1].slice(0, 12), txt: m[2].slice(0, 120) } : { ano: x.slice(0, 12), txt: "" };
    }),
    source: POI_SOURCES.includes(String(b.source)) ? String(b.source) : "Curadoria",
    active: b.active !== false,
  };
}
