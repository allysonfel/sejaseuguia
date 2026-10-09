// Assistente da viagem. Duas etapas:
//   1. entender: regras por palavra inteira reconhecem os pedidos comuns na hora, sem IA.
//      Se o pedido for ambíguo, negado ou fora das regras, devolve null e o app pergunta à IA
//      (/api/assistant), que só escolhe uma das mesmas ações ou responde com os dados do roteiro.
//   2. executar: o motor calcula a mudança e devolve uma prévia para a pessoa aplicar.

import {
  addPoi, eligible, haversineKm, lateAdj, nearestUnused, rainSwap, saveAdj, sched, tiredAdj, travel,
  type Ctx,
} from "./engine";
import { faixaTxt, hm, priceTxt } from "./format";
import type { DayPlan, Place, Poi, ReplanKind } from "./types";

export type Reply = {
  t: string;
  cards?: [string, string][];
  apply?: string;
  preview?: DayPlan[];
  kind?: ReplanKind;
};

export const ACOES = ["chuva", "cansado", "atraso", "economizar", "restaurante", "tranquilo", "remover", "mover", "perto", "ajuda", "responder", "esclarecer"] as const;
export type Acao = (typeof ACOES)[number];

export type Intencao = {
  acao: Acao;
  /** id do lugar do dia (remover, mover) */
  alvo?: number;
  /** dia de destino, começando em 1 (mover) */
  dia?: number;
  /** trocar por algo ao ar livre (remover) */
  arLivre?: boolean;
  /** priorizar o mais barato (restaurante) */
  barato?: boolean;
  /** tipo de comida ou lugar pedido, para casar com as etiquetas */
  palavras?: string[];
  /** resposta pronta (responder, esclarecer) */
  texto?: string;
};

export const QUICK = [
  "Quero algo tranquilo perto do hotel",
  "Está chovendo. O que posso fazer?",
  "Estou cansado. Diminua o ritmo",
  "Quero um restaurante perto",
  "Tire o museu e coloque algo ao ar livre",
  "Quero economizar hoje",
];

const AJUDA = "Posso ajustar o ritmo, trocar ou tirar atividades, sugerir lugares e restaurantes perto do roteiro ou reorganizar o dia por causa da chuva, de atraso ou para economizar.";

export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// ------------------------------------------------------------ entender (regras)

// Termos sem acento. "x*" casa com palavra que começa com x; com espaço é frase inteira.
const TERMOS: Record<Exclude<Acao, "ajuda" | "responder" | "esclarecer" | "mover">, string[]> = {
  chuva: ["chuva*", "chov*", "chuvos*", "temporal", "tempestade", "garoa*", "aguaceiro"],
  cansado: ["cansad*", "cansaco", "exaust*", "esgotad*", "morto de cansaco", "devagar", "descans*", "ritmo", "mais leve", "menos corrido", "menos correria", "menos coisas", "pegar leve", "dia pesado", "sem pressa"],
  atraso: ["atrasad*", "atrasei", "atrasamos", "atrasou", "atraso", "atrasar", "perdi a hora", "perdemos a hora", "acordei tarde", "acordamos tarde", "sai tarde", "saimos tarde", "sair mais tarde", "comecar mais tarde", "dormi demais", "dormimos demais"],
  economizar: ["econom*", "barat*", "gastar menos", "gastar pouco", "gratis", "gratuit*", "sem gastar", "sem pagar", "mais em conta", "orcamento", "muito caro", "caro demais", "pouco dinheiro", "sem dinheiro"],
  restaurante: ["restaurante*", "comer", "comida*", "almoc*", "jantar", "janta", "fome", "lanch*", "cafe da manha", "pizza*", "hamburguer*", "sushi", "frutos do mar", "petisco*", "churrasc*", "doceria", "sorvete*"],
  tranquilo: ["tranquil*", "calm*", "sosseg*", "relax*", "sem multidao", "sem muvuca", "menos cheio", "menos gente", "silenci*"],
  remover: ["tire", "tira", "tirar", "tirem", "remov*", "retir*", "cancel*", "pular", "pule", "nao quero ir", "nao quero mais", "troc*", "substitu*"],
  perto: ["perto", "proxim*", "por aqui", "ao redor", "arredores", "sugest*", "sugere", "sugira", "indica", "indique", "recomend*"],
};

const SAUDACAO = ["oi", "ola", "bom dia", "boa tarde", "boa noite", "ajuda", "socorro", "o que voce faz", "o que voce sabe fazer", "como funciona"];

// Palavras que não dizem o tipo de comida/lugar pedido.
const GENERICAS = new Set([
  "quero", "queria", "gostaria", "restaurante", "restaurantes", "comer", "almoco", "almocar", "jantar", "perto", "lugar", "algum", "alguma", "algo",
  "onde", "para", "hoje", "aqui", "fome", "lanche", "comida", "sugere", "sugira", "barato", "barata", "baratos", "baratas", "bom", "boa", "mais",
  "tire", "tira", "tirar", "troque", "trocar", "troca", "coloque", "colocar", "outro", "outra", "pode", "voce", "esse", "essa", "este", "esta",
  "posso", "podemos", "podia", "poderia", "temos", "estou", "estamos", "muito", "pouco", "coisa", "favor", "gente", "nossa", "agora", "depois",
  "tarde", "noite", "manha", "aqui", "legal", "gostoso", "gostosa", "comida", "comidas", "lugares", "opcao", "opcoes", "ideia", "dica", "dicas",
  "pertinho", "proximo", "proxima", "melhor", "tipo", "fazer", "visitar", "conhecer", "ir", "vamos", "preciso", "precisamos", "atividade",
  "museu", "igreja", "mosteiro", "torre", "parada", "passeio", "ultimo", "ultima", "primeiro", "primeira", "segundo", "segunda", "terceiro", "terceira",
  "remove", "remova", "remover", "retire", "retirar", "cancela", "cancelar", "pular", "substitua", "substituir", "coloca", "bote", "botar", "livre",
]);

// Pergunta de informação ("que horas abre o restaurante?") não é pedido de mudança: vai para a IA responder.
const PERGUNTA = ["que horas", "quanto tempo", "quanto custa", "quanto e", "qual o horario", "qual horario", "horario", "abre", "fecha", "aberto", "aberta", "como chego", "como chegar", "onde fica", "quando", "qual a distancia", "longe"];
// Pedido contrário ao que as regras fazem ("aumente o ritmo") ou fora delas ("passe para amanhã").
const FORA = ["aument*", "acelera*", "intens*", "mais atividade*", "mais coisa*", "outro dia", "amanha", "ontem", "de dia", "adiant*"];

const OUTDOOR = ["ar livre", "ao ar livre", "natureza", "parque*", "praia*", "jardim", "jardins", "trilha*", "mirante*"];

const palavrasDe = (q: string) => q.trim().split(" ").filter(Boolean);

function casa(q: string, termos: string[]): boolean {
  const ws = palavrasDe(q);
  return termos.some((t) => (t.endsWith("*") ? ws.some((w) => w.startsWith(t.slice(0, -1))) : (" " + q + " ").includes(" " + t + " ")));
}

/** Texto normalizado em palavras separadas por um espaço, sem "tirar foto" (não é tirar do roteiro). */
function limpa(qRaw: string) {
  return norm(qRaw).replace(/[^a-z0-9]+/g, " ").replace(/\btir\w* (uma |umas |a |as )?fotos?\b/g, " ").replace(/\s+/g, " ").trim();
}

const ORDINAIS: [string[], (n: number) => number][] = [
  [["primeira", "primeiro"], () => 0],
  [["segunda", "segundo"], () => 1],
  [["terceira", "terceiro"], () => 2],
  [["ultima", "ultimo"], (n) => n - 1],
];

/** Lugar do dia que o pedido cita (por nome, categoria ou posição). null se nenhum ou mais de um. */
function alvoDoPedido(q: string, day: DayPlan, ctx: Ctx): number | null {
  const ws = new Set(palavrasDe(q));
  const achados = new Set<number>();
  for (const it of day.items) {
    const p = ctx.pois[it.p];
    if (!p) continue;
    const nome = palavrasDe(limpa(p.nome)).filter((w) => w.length > 3);
    const cat = palavrasDe(limpa(p.cat));
    if (nome.some((w) => ws.has(w)) || cat.some((w) => ws.has(w) || ws.has(w + "s")) || (p.meal && casa(q, ["restaurante*", "almoco", "jantar"]))) achados.add(p.id);
  }
  if (achados.size === 1) return [...achados][0];
  if (achados.size > 1) return null;
  for (const [ws2, f] of ORDINAIS) {
    if (ws2.some((w) => ws.has(w))) {
      const p = day.items[f(day.items.length)]?.p;
      return p ?? null;
    }
  }
  return null;
}

/**
 * Pedido comum reconhecido com segurança. null quando não dá para ter certeza
 * (nenhuma regra, duas ações ao mesmo tempo, negação, alvo não achado): aí o app pergunta à IA.
 */
export function entender(qRaw: string, day: DayPlan, ctx: Ctx): Intencao | null {
  const q = limpa(qRaw);
  if (!q) return null;
  const achadas = (Object.keys(TERMOS) as (keyof typeof TERMOS)[]).filter((a) => casa(q, TERMOS[a]));
  // "perto" é fraco: só vale sozinho ("restaurante perto" é restaurante)
  const fortes = achadas.filter((a) => a !== "perto");
  const negado = /\b(nao|nem|nunca)\b/.test(q) && !casa(q, ["nao quero ir", "nao quero mais"]);

  if (!achadas.length) return SAUDACAO.some((s) => q === s || q.startsWith(s + " ")) && palavrasDe(q).length <= 5 ? { acao: "ajuda" } : null;
  if (negado || casa(q, PERGUNTA) || casa(q, FORA)) return null;

  let acao: keyof typeof TERMOS;
  if (fortes.length === 0) acao = "perto";
  else if (fortes.length === 1) acao = fortes[0];
  else if (fortes.length === 2 && fortes.includes("restaurante") && fortes.includes("economizar")) acao = "restaurante";
  else if (fortes.length === 2 && fortes.includes("remover") && (fortes.includes("restaurante") || fortes.includes("tranquilo"))) acao = "remover";
  else return null;

  const palavras = palavrasDe(q).filter((w) => w.length > 3 && !GENERICAS.has(w));
  if (acao === "restaurante") return { acao, palavras, barato: fortes.includes("economizar") };
  if (acao === "remover") {
    const alvo = alvoDoPedido(q, day, ctx);
    if (alvo == null) return null;
    return { acao, alvo, arLivre: casa(q, OUTDOOR), palavras };
  }
  return { acao };
}

// ------------------------------------------------------------ executar

function dayCenter(day: DayPlan, ctx: Ctx): Place {
  const ps = day.items.map((i) => ctx.pois[i.p]).filter(Boolean);
  if (!ps.length) return ctx.hotel;
  return { lat: ps.reduce((a, p) => a + p.lat, 0) / ps.length, lng: ps.reduce((a, p) => a + p.lng, 0) / ps.length };
}

const legTxt = (from: Place, p: Poi, ctx: Ctx) => {
  const l = travel(from, p, ctx.profile, ctx.rules);
  return l.min + " min " + l.modo;
};

// Etiqueta, categoria ou palavra do nome ("sushi" acha "Sushi Lisboa").
const casaEtiqueta = (p: Poi, palavras: string[]) => {
  const nome = palavrasDe(limpa(p.nome + " " + p.cat));
  return palavras.some((w) => p.tags.some((t) => norm(t).startsWith(w.slice(0, 5))) || nome.includes(w));
};

/** Executa a ação já entendida (pelas regras ou pela IA). */
export function executar(it: Intencao, days: DayPlan[], idx: number, ctx: Ctx, moeda: string): Reply {
  const day = days[idx];
  const dn = "Dia " + (idx + 1);
  const palavras = (it.palavras ?? []).map((w) => limpa(w)).filter((w) => w.length > 2);

  switch (it.acao) {
    case "chuva": {
      const r = rainSwap(days, idx, ctx);
      if (!r.changed) return { t: "Olhei o " + dn + ": " + (r.msg.startsWith("As atividades") ? "as atividades já são cobertas ou têm reserva. Não precisa mudar nada." : r.msg) };
      return { t: "Para o " + dn + ", troquei o que é ao ar livre por opções cobertas por perto, sem mexer no que tem reserva:", cards: [["Troca", r.msg]], apply: "Aplicar troca", preview: r.days, kind: "rain" };
    }
    case "cansado": {
      const r = tiredAdj(days, idx, ctx);
      return { t: "Entendido. " + r.msg, apply: "Diminuir o ritmo", preview: r.days, kind: "tired" };
    }
    case "atraso": {
      const r = lateAdj(days, idx, ctx);
      return { t: r.msg, apply: "Reorganizar o dia", preview: r.days, kind: "late" };
    }
    case "economizar": {
      const r = saveAdj(days, idx, ctx);
      if (!r.changed) return { t: r.msg };
      return { t: "Achei alternativas mais baratas parecidas com o que você gosta no " + dn + ":", cards: [["Troca", r.msg]], apply: "Usar versão econômica", preview: r.days, kind: "save" };
    }
    case "restaurante": {
      const center = dayCenter(day, ctx);
      const meals = Object.values(ctx.pois).filter((p) => p.meal && eligible(p, ctx) && !day.items.some((i) => i.p === p.id));
      const byTag = palavras.length ? meals.filter((p) => casaEtiqueta(p, palavras)) : [];
      const list = (byTag.length ? byTag : meals)
        .sort((a, b) => (it.barato ? a.preco - b.preco : 0) || haversineKm(a, center) - haversineKm(b, center))
        .slice(0, 3);
      if (!list.length) return { t: "Não encontrei outro lugar para comer cadastrado perto do seu roteiro desse dia." };
      const best = list[0];
      const next = JSON.parse(JSON.stringify(days)) as DayPlan[];
      const mi = next[idx].items.findIndex((i) => ctx.pois[i.p]?.meal && !i.fixed);
      let preview: DayPlan[];
      if (mi >= 0) { next[idx].items[mi] = { p: best.id }; preview = next; }
      else preview = addPoi(days, idx, best.id, ctx).days;
      return {
        t: (byTag.length ? "Achei" : palavras.length ? "Não achei exatamente esse tipo, mas separei" : "Separei") + " opções" + (it.barato ? " mais em conta" : "") + " perto de onde vocês vão estar no " + dn + ":",
        cards: list.map((p) => [p.nome, p.bairro + " · " + priceTxt(p.preco, moeda) + " · " + legTxt(center, p, ctx) + " do centro do dia"]),
        apply: mi >= 0 ? "Trocar a refeição por " + best.nome : "Colocar " + best.nome + " no dia",
        preview, kind: "add",
      };
    }
    case "tranquilo": {
      const calm = nearestUnused(ctx.hotel, (p) => eligible(p, ctx) && !p.meal && (p.cat === "Parque" || (p.indoor && p.dur <= 60 && !p.reserva)), days, ctx).slice(0, 3);
      if (!calm.length) return { t: "Não encontrei mais opções calmas perto do hotel que ainda não estejam no roteiro." };
      return {
        t: "Separei opções calmas perto do hotel, fora das atrações mais disputadas:",
        cards: calm.map((p) => [p.nome, p.cat + " · " + legTxt(ctx.hotel, p, ctx) + " do hotel"]),
        apply: "Colocar " + calm[0].nome + " no " + dn, preview: addPoi(days, idx, calm[0].id, ctx).days, kind: "add",
      };
    }
    case "remover": {
      const target = day.items.findIndex((i) => i.p === it.alvo);
      if (target < 0) return { t: "Não encontrei no " + dn + " o que você quer tirar. Diga o nome do lugar." };
      const old = ctx.pois[day.items[target].p];
      if (day.items[target].fixed) return { t: old.nome + " tem reserva às " + day.items[target].fixed + ", então não tiro pelo assistente. Se a reserva mudou, ajuste em Reservas." };
      if (day.items[target].done) return { t: old.nome + " já está marcado como feito no " + dn + "." };
      const alt = old.meal
        ? nearestUnused(old, (p) => p.meal && eligible(p, ctx) && (!palavras.length || casaEtiqueta(p, palavras)), days, ctx)[0]
        : nearestUnused(old, (p) => eligible(p, ctx) && !p.meal && (it.arLivre ? !p.indoor : p.cat !== old.cat), days, ctx)[0];
      const next = JSON.parse(JSON.stringify(days)) as DayPlan[];
      if (alt) next[idx].items[target] = { p: alt.id };
      else next[idx].items.splice(target, 1);
      const tight = sched(next[idx], idx, ctx).items.some((i) => i.warn);
      return {
        t: (alt ? "Tirei " + old.nome + " e coloquei uma opção no mesmo caminho, para não aumentar o deslocamento:" : "Tirei " + old.nome + ". Não achei substituto por perto, então o dia ficou mais leve.") +
          (tight ? " Atenção: depois da troca algum horário fica apertado." : ""),
        cards: alt ? [[alt.nome, alt.dur + " min · " + priceTxt(alt.preco, moeda) + " · " + legTxt(old, alt, ctx) + " da parada anterior"]] : undefined,
        apply: "Confirmar", preview: next, kind: "remove",
      };
    }
    case "mover": {
      const i = day.items.findIndex((x) => x.p === it.alvo);
      const dest = (it.dia ?? 0) - 1;
      if (i < 0 || dest < 0 || dest >= days.length || dest === idx) return { t: "Para qual dia você quer passar? Diga o lugar e o dia, por exemplo: passe o museu para o Dia " + (idx + 2 > days.length ? 1 : idx + 2) + "." };
      const p = ctx.pois[day.items[i].p];
      if (day.items[i].fixed) return { t: p.nome + " tem reserva às " + day.items[i].fixed + ", então não mudo de dia pelo assistente. Se a reserva mudou, ajuste em Reservas." };
      const r = addPoi(days, dest, p.id, ctx);
      const s = sched(r.days[dest], dest, ctx);
      const pos = s.items.find((x) => x.p === p.id);
      return {
        t: "Passei " + p.nome + " para o Dia " + (dest + 1) + " (" + s.label + ")" + (pos ? ", por volta das " + hm(pos.ini) : "") + ", na posição que menos aumenta o deslocamento." + (s.items.some((x) => x.warn) ? " Atenção: algum horário do Dia " + (dest + 1) + " fica apertado." : ""),
        apply: "Passar para o Dia " + (dest + 1), preview: r.days, kind: "carry",
      };
    }
    case "perto": {
      const c = dayCenter(day, ctx);
      const list = nearestUnused(c, (p) => eligible(p, ctx) && !p.meal && (palavras.length && Object.values(ctx.pois).some((x) => casaEtiqueta(x, palavras)) ? casaEtiqueta(p, palavras) : p.tags.some((t) => ctx.profile.int.includes(t))), days, ctx).slice(0, 3);
      if (!list.length) return { t: "Tudo o que combina com você por perto já está no roteiro." };
      return {
        t: "Perto do roteiro do " + dn + " e combinando com seu perfil:",
        cards: list.map((p) => [p.nome, p.cat + " · " + p.bairro + " · " + p.dur + " min"]),
        apply: "Colocar " + list[0].nome + " no dia", preview: addPoi(days, idx, list[0].id, ctx).days, kind: "add",
      };
    }
    case "responder":
    case "esclarecer":
      return { t: it.texto || AJUDA };
    default:
      return { t: AJUDA + " Experimente uma das sugestões abaixo." };
  }
}

/** Só regras (sem IA). Pedido não entendido vira a ajuda, nunca um chute. */
export function reply(qRaw: string, days: DayPlan[], idx: number, ctx: Ctx, moeda: string): Reply {
  const it = entender(qRaw, days[idx], ctx);
  if (it) return executar(it, days, idx, ctx, moeda);
  return { t: "Não entendi bem o pedido. " + AJUDA + " Experimente uma das sugestões abaixo." };
}

// ------------------------------------------------------------ resumo para a IA

export type ResumoItem = {
  id: number; nome: string; cat: string; bairro: string; trajeto: string; chegada: string; saida: string; abre: string; fecha: string;
  preco: string; reserva: string | null; coberto: boolean; refeicao: boolean; feito: boolean; alerta: string | null;
};
export type Resumo = {
  dia: number; data: string; totalDias: number; saidaHotel: string; voltaHotel: string; voltaHotelTrajeto: string; hotel: string; moeda: string;
  itens: ResumoItem[]; outrosDias: { dia: number; data: string; lugares: string[] }[];
};

/** O que a IA precisa saber do roteiro para entender e responder. Sem dado pessoal. */
export function resumir(days: DayPlan[], idx: number, ctx: Ctx, moeda: string): Resumo {
  const s = sched(days[idx], idx, ctx);
  return {
    dia: idx + 1, data: s.label, totalDias: days.length, saidaHotel: hm(s.start), voltaHotel: hm(s.end), voltaHotelTrajeto: s.back.min + " min " + s.back.modo, hotel: ctx.hotel.nome, moeda,
    itens: s.items.map((i, k) => ({
      id: i.poi.id, nome: i.poi.nome, cat: i.poi.cat, bairro: i.poi.bairro, trajeto: i.tr.min + " min " + i.tr.modo + " desde " + (k ? s.items[k - 1].poi.nome : "o hotel"),
      chegada: hm(i.ini), saida: hm(i.fim), abre: i.poi.abre, fecha: i.poi.fecha, preco: faixaTxt(i.poi.preco, moeda), reserva: i.fixed ?? null, coberto: i.poi.indoor,
      refeicao: i.poi.meal, feito: !!i.done, alerta: i.warn === "fechado" ? "fechado nesse dia" : i.warn === "fecha" ? "termina depois de fechar" : i.late ? "chega depois da reserva" : null,
    })),
    outrosDias: days.map((d, k) => ({ dia: k + 1, data: sched(d, k, ctx).label, lugares: d.items.map((x) => ctx.pois[x.p]?.nome).filter(Boolean) as string[] })).filter((d) => d.dia !== idx + 1),
  };
}
