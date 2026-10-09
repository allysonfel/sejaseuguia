import { apiTraveler, fail, ok, readBody, str } from "@/lib/api";
import type { Resumo, ResumoItem } from "@/lib/assistant";
import { entenderComIA } from "@/lib/iaAssistente";
import { assistenteLiberado } from "@/lib/limiteAssistente";

// Assistente da viagem: só é chamado quando as regras do app não entenderam o pedido.
// Devolve a intenção (o app executa com o motor) ou { intencao: null } para o app
// mostrar a ajuda. Nada é guardado.

const hora = (v: unknown) => (typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : "");
const int = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

function limpaItem(v: unknown): ResumoItem | null {
  if (!v || typeof v !== "object") return null;
  const x = v as Record<string, unknown>;
  const id = int(x.id, 1, 2 ** 31), nome = str(x.nome, 100);
  if (id == null || !nome) return null;
  return {
    id, nome, cat: str(x.cat, 40), bairro: str(x.bairro, 60), trajeto: str(x.trajeto, 160), chegada: hora(x.chegada), saida: hora(x.saida), abre: hora(x.abre), fecha: hora(x.fecha),
    preco: str(x.preco, 30), reserva: hora(x.reserva) || null, coberto: x.coberto === true, refeicao: x.refeicao === true, feito: x.feito === true,
    alerta: str(x.alerta, 40) || null,
  };
}

function limpaResumo(v: unknown): Resumo | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const dia = int(r.dia, 1, 60), totalDias = int(r.totalDias, 1, 60);
  if (dia == null || totalDias == null || dia > totalDias || !Array.isArray(r.itens)) return null;
  const outros = Array.isArray(r.outrosDias) ? r.outrosDias.slice(0, 30) : [];
  return {
    dia, data: str(r.data, 40), totalDias, saidaHotel: hora(r.saidaHotel), voltaHotel: hora(r.voltaHotel), voltaHotelTrajeto: str(r.voltaHotelTrajeto, 60), hotel: str(r.hotel, 100), moeda: str(r.moeda, 4),
    itens: r.itens.slice(0, 20).map(limpaItem).filter((x): x is ResumoItem => !!x),
    outrosDias: outros.map((d) => {
      const o = (d ?? {}) as Record<string, unknown>;
      return { dia: int(o.dia, 1, 60) ?? 0, data: str(o.data, 40), lugares: (Array.isArray(o.lugares) ? o.lugares : []).slice(0, 15).map((l) => str(l, 100)).filter(Boolean) };
    }).filter((d) => d.dia > 0),
  };
}

export async function POST(req: Request) {
  const u = await apiTraveler();
  if (!u) return fail("Entre de novo para continuar.", 401);
  const b = await readBody<{ q: string; resumo: Resumo }>(req);
  const q = str(b.q, 300);
  const resumo = limpaResumo(b.resumo);
  if (!q || !resumo) return fail("Pedido inválido.");
  if (!assistenteLiberado(u.id)) return ok({ intencao: null });
  return ok({ intencao: await entenderComIA(q, resumo) });
}
