// Assistente da viagem por regras (sem IA): reconhece o pedido por palavras,
// calcula a mudança com o motor e devolve uma prévia para a pessoa aplicar.

import {
  addPoi, eligible, haversineKm, lateAdj, nearestUnused, rainSwap, saveAdj, sched, tiredAdj, travel,
  type Ctx,
} from "./engine";
import type { DayPlan, Place, Poi, ReplanKind } from "./types";

export type Reply = {
  t: string;
  cards?: [string, string][];
  apply?: string;
  preview?: DayPlan[];
  kind?: ReplanKind;
};

export const QUICK = [
  "Quero algo tranquilo perto do hotel",
  "Está chovendo. O que posso fazer?",
  "Estou cansado. Diminua o ritmo",
  "Quero um restaurante perto",
  "Tire o museu e coloque algo ao ar livre",
  "Quero economizar hoje",
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const has = (q: string, ...w: string[]) => w.some((x) => q.includes(x));

function dayCenter(day: DayPlan, ctx: Ctx): Place {
  const ps = day.items.map((i) => ctx.pois[i.p]).filter(Boolean);
  if (!ps.length) return ctx.hotel;
  return { lat: ps.reduce((a, p) => a + p.lat, 0) / ps.length, lng: ps.reduce((a, p) => a + p.lng, 0) / ps.length };
}

const legTxt = (from: Place, p: Poi, ctx: Ctx) => {
  const l = travel(from, p, ctx.profile, ctx.rules);
  return l.min + " min " + l.modo;
};

export function reply(qRaw: string, days: DayPlan[], idx: number, ctx: Ctx, moeda: string): Reply {
  const q = norm(qRaw);
  const day = days[idx];
  const dn = "Dia " + (idx + 1);

  if (has(q, "chov", "chuva")) {
    const r = rainSwap(days, idx, ctx);
    if (!r.changed) return { t: "Olhei o " + dn + ": as atividades já são cobertas ou têm reserva. Não precisa mudar nada." };
    return { t: "Para o " + dn + ", troquei o que é ao ar livre por opções cobertas por perto, sem mexer no que tem reserva:", cards: [["Troca", r.msg]], apply: "Aplicar troca", preview: r.days, kind: "rain" };
  }
  if (has(q, "cansad", "devagar", "descans", "ritmo", "exausto")) {
    const r = tiredAdj(days, idx, ctx);
    return { t: "Entendido. " + r.msg, apply: "Diminuir o ritmo", preview: r.days, kind: "tired" };
  }
  if (has(q, "atras", "atrasei", "perdi a hora", "acordei tarde")) {
    const r = lateAdj(days, idx, ctx);
    return { t: r.msg, apply: "Reorganizar o dia", preview: r.days, kind: "late" };
  }
  if (has(q, "econom", "barato", "gastar menos", "gratis", "sem gastar")) {
    const r = saveAdj(days, idx, ctx);
    if (!r.changed) return { t: r.msg };
    return { t: "Achei alternativas mais baratas parecidas com o que você gosta no " + dn + ":", cards: [["Troca", r.msg]], apply: "Usar versão econômica", preview: r.days, kind: "save" };
  }
  if (has(q, "restaurante", "comer", "almoc", "jantar", "fome", "lanche", "comida")) {
    const GENERIC = ["quero", "restaurante", "restaurantes", "comer", "almoco", "almocar", "jantar", "perto", "lugar", "algum", "alguma", "onde", "para", "hoje", "aqui", "fome", "lanche", "comida", "sugere", "sugira"];
    const words = q.split(/[^a-z]+/).filter((w) => w.length > 3 && !GENERIC.includes(w));
    const center = dayCenter(day, ctx);
    const meals = Object.values(ctx.pois).filter((p) => p.meal && eligible(p, ctx) && !day.items.some((i) => i.p === p.id));
    const byTag = meals.filter((p) => p.tags.some((t) => words.some((w) => norm(t).startsWith(w.slice(0, 5)))));
    const list = (byTag.length ? byTag : meals).sort((a, b) => haversineKm(a, center) - haversineKm(b, center)).slice(0, 3);
    if (!list.length) return { t: "Não encontrei outro lugar para comer cadastrado perto do seu roteiro desse dia." };
    const best = list[0];
    const next = JSON.parse(JSON.stringify(days)) as DayPlan[];
    const mi = next[idx].items.findIndex((i) => ctx.pois[i.p]?.meal && !i.fixed);
    let preview: DayPlan[];
    if (mi >= 0) { next[idx].items[mi] = { p: best.id }; preview = next; }
    else preview = addPoi(days, idx, best.id, ctx).days;
    return {
      t: (byTag.length ? "Achei" : words.length ? "Não achei exatamente esse tipo, mas separei" : "Separei") + " opções perto de onde vocês vão estar no " + dn + ":",
      cards: list.map((p) => [p.nome, p.bairro + " · " + (p.preco ? moeda.repeat(p.preco) : "grátis") + " · " + legTxt(center, p, ctx) + " do centro do dia"]),
      apply: mi >= 0 ? "Trocar a refeição por " + best.nome : "Colocar " + best.nome + " no dia",
      preview, kind: "add",
    };
  }
  if (has(q, "tranquil", "calm", "sossego", "relax", "sem multidao", "silencio")) {
    const calm = nearestUnused(ctx.hotel, (p) => eligible(p, ctx) && !p.meal && (p.cat === "Parque" || (p.indoor && p.dur <= 60 && !p.reserva)), days, ctx).slice(0, 3);
    if (!calm.length) return { t: "Não encontrei mais opções calmas perto do hotel que ainda não estejam no roteiro." };
    return {
      t: "Separei opções calmas perto do hotel, fora das atrações mais disputadas:",
      cards: calm.map((p) => [p.nome, p.cat + " · " + legTxt(ctx.hotel, p, ctx) + " do hotel"]),
      apply: "Colocar " + calm[0].nome + " no " + dn, preview: addPoi(days, idx, calm[0].id, ctx).days, kind: "add",
    };
  }
  if (has(q, "tire", "tira", "remov", "retir", "nao quero", "sem o", "sem a")) {
    const target = day.items.findIndex((i) => {
      const p = ctx.pois[i.p];
      if (!p || i.fixed) return false;
      const name = norm(p.nome);
      return q.includes(norm(p.cat)) || name.split(/\s+/).some((w) => w.length > 4 && q.includes(w));
    });
    if (target < 0) return { t: "Não encontrei no " + dn + " o que você quer tirar (ou tem reserva e não pode sair). Diga o nome do lugar." };
    const old = ctx.pois[day.items[target].p];
    const outdoor = has(q, "ar livre", "fora", "parque", "natureza");
    const alt = nearestUnused(old, (p) => eligible(p, ctx) && !p.meal && (outdoor ? !p.indoor : p.cat !== old.cat), days, ctx)[0];
    const next = JSON.parse(JSON.stringify(days)) as DayPlan[];
    if (alt) next[idx].items[target] = { p: alt.id };
    else next[idx].items.splice(target, 1);
    const tight = sched(next[idx], idx, ctx).items.some((i) => i.warn);
    return {
      t: (alt ? "Tirei " + old.nome + " e coloquei uma opção no mesmo caminho, para não aumentar o deslocamento:" : "Tirei " + old.nome + ". Não achei substituto por perto, então o dia ficou mais leve.") +
        (tight ? " Atenção: depois da troca algum horário fica apertado." : ""),
      cards: alt ? [[alt.nome, alt.dur + " min · " + (alt.preco ? moeda.repeat(alt.preco) : "grátis") + " · " + legTxt(old, alt, ctx) + " da parada anterior"]] : undefined,
      apply: "Confirmar", preview: next, kind: "remove",
    };
  }
  if (has(q, "perto", "por aqui", "proximo", "ao redor", "sugest")) {
    const c = dayCenter(day, ctx);
    const list = nearestUnused(c, (p) => eligible(p, ctx) && !p.meal && p.tags.some((t) => ctx.profile.int.includes(t)), days, ctx).slice(0, 3);
    if (!list.length) return { t: "Tudo o que combina com você por perto já está no roteiro." };
    return {
      t: "Perto do roteiro do " + dn + " e combinando com seu perfil:",
      cards: list.map((p) => [p.nome, p.cat + " · " + p.bairro + " · " + p.dur + " min"]),
      apply: "Colocar " + list[0].nome + " no dia", preview: addPoi(days, idx, list[0].id, ctx).days, kind: "add",
    };
  }
  return { t: "Posso ajustar o ritmo, trocar atividades, sugerir lugares e restaurantes perto do roteiro ou reorganizar o dia por causa da chuva, de atraso ou para economizar. Experimente uma das sugestões abaixo." };
}
