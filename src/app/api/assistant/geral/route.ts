import { apiTraveler, fail, ok, readBody, str } from "@/lib/api";
import { listTripsForUser, pickActiveTrip, tripStatus } from "@/lib/data";
import { sql } from "@/lib/db";
import { dmy, firstName, longToday, todayIso } from "@/lib/format";
import { TELAS, duvidaComum, duvidaDocumentos, telaDoCaminho, type Tela } from "@/lib/guiaApp";
import { responderGeral, type ViagemResumo } from "@/lib/iaAssistente";
import { assistenteLiberado } from "@/lib/limiteAssistente";
import { DEFAULT_PROFILE } from "@/lib/types";

// Assistente geral (todas as telas). Dúvida comum do app sai pelas regras, na hora;
// o resto vai para a IA com as viagens do próprio viajante (lidas aqui no servidor,
// nunca do navegador). Nada é guardado.

const PAPEL = { owner: "organizador", editor: "pode editar", viewer: "só vê" } as const;

function conversa(v: unknown) {
  if (!Array.isArray(v)) return [];
  return v.slice(-6).map((m) => {
    const x = (m ?? {}) as Record<string, unknown>;
    return { r: x.r === "u" ? ("u" as const) : ("b" as const), t: str(x.t, 400) };
  }).filter((m) => m.t);
}

const resposta = (t: string, ir: Tela | null) => ({ t, ir: ir ? { href: TELAS[ir].href, nome: TELAS[ir].nome } : null });

export async function POST(req: Request) {
  const u = await apiTraveler();
  if (!u) return fail("Entre de novo para continuar.", 401);
  const b = await readBody<{ q: string; caminho: string; conversa: unknown }>(req);
  const q = str(b.q, 300);
  if (!q) return fail("Pedido inválido.");

  const doc = duvidaDocumentos(q);
  if (doc) return ok(resposta(doc, "perfil"));
  const comum = duvidaComum(q);
  if (comum) return ok(resposta(comum.t, comum.ir ?? null));
  if (!assistenteLiberado(u.id)) return ok(resposta("Muitas perguntas seguidas. Espere uns minutos e pergunte de novo.", null));

  const hoje = todayIso();
  const trips = await listTripsForUser(u);
  const ativa = pickActiveTrip(trips, hoje);
  // Lugares de cada dia só da viagem atual (ou da próxima), para perguntas como "o que tem no dia 2?".
  const ids = ativa ? [...new Set(ativa.days.flatMap((d) => d.items.map((i) => i.p)))] : [];
  const nomes = new Map(ids.length ? (await sql<{ id: number; nome: string }[]>`SELECT id, nome FROM pois WHERE id = ANY(${ids})`).map((p) => [p.id, p.nome]) : []);
  const viagens: ViagemResumo[] = trips.slice(0, 8).map((t) => ({
    destino: t.destino, pais: t.pais, inicio: dmy(t.inicio), fim: dmy(t.fim), status: tripStatus(t, hoje), papel: PAPEL[t.access], hotel: t.hotel.nome,
    dias: t === ativa ? t.days.map((d, k) => ({ dia: k + 1, lugares: d.items.map((i) => nomes.get(i.p)).filter((x): x is string => !!x) })) : undefined,
  }));
  const p = u.profile ?? DEFAULT_PROFILE;

  const r = await responderGeral(q, {
    tela: telaDoCaminho(str(b.caminho, 120)),
    hoje: longToday(hoje),
    nome: firstName(u.nome),
    perfil: `${p.comp}, ritmo ${p.ritmo}, orçamento ${p.orc}, gosta de ${p.int.join(", ")}`,
    viagens,
    conversa: conversa(b.conversa),
  });
  if (!r) return ok(resposta("Não consegui responder agora. Tente de novo em instantes, ou fale com a agência em Perfil, Ajuda e suporte.", null));
  return ok(resposta(r.texto, r.ir));
}
