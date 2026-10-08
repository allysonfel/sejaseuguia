// Motor de roteiros: calcula horários e trajetos, monta o roteiro a partir
// do perfil e replaneja (chuva, cansaço, atraso, economia...). Código puro,
// sem banco: roda no servidor (gerar a viagem) e no cliente (ajustes na hora).

import { addDays, dayLabel, toMin, weekday } from "./format";
import type { DayPlan, Hotel, Item, Place, Poi, Profile, Rules } from "./types";

export type Ctx = {
  pois: Record<number, Poi>;
  hotel: Hotel;
  profile: Profile;
  rules: Rules;
  /** data do Dia 1, "YYYY-MM-DD" */
  inicio: string;
};

export type Mode = "a pé" | "transporte público" | "carro" | "app de transporte";
export type Leg = { km: number; min: number; modo: Mode };

export type SItem = Item & {
  poi: Poi;
  tr: Leg;
  wait: number;
  ini: number;
  fim: number;
  /** "fecha": termina depois do fechamento; "fechado": não abre nesse dia */
  warn: null | "fecha" | "fechado";
  /** chega depois do horário reservado */
  late: boolean;
};

export type SDay = {
  idx: number;
  date: string;
  label: string;
  tema: string;
  start: number;
  items: SItem[];
  back: Leg;
  end: number;
  walk: number;
  moveMin: number;
  endFixed: string | null;
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

// ------------------------------------------------------------ distâncias

export function haversineKm(a: Place, b: Place): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Distância pelas ruas: a linha reta vezes um fator de traçado urbano. */
const streetKm = (a: Place, b: Place) => haversineKm(a, b) * 1.3;

export function legFor(km: number, modo: Mode, folga = 0): Leg {
  const base =
    modo === "a pé" ? Math.max(3, Math.round(km * 13)) :
    modo === "transporte público" ? Math.round(8 + km * 3.4) :
    modo === "carro" ? Math.round(5 + km * 2.4) :
    Math.round(6 + km * 2.6);
  return { km, min: base + (modo === "a pé" ? 0 : folga), modo };
}

/** Trajeto entre dois pontos respeitando como a pessoa gosta de se locomover. */
export function travel(a: Place, b: Place, profile?: Profile, rules?: Rules): Leg {
  const km = streetKm(a, b);
  const mob = profile?.mob ?? [];
  const any = mob.length === 0;
  const walkMax = profile?.evitar.includes("Excesso de caminhada") ? 0.8 : 1.3;
  const folga = rules?.folga ?? 0;
  if (km <= walkMax && (any || mob.includes("Caminhar") || km < 0.4)) return legFor(km, "a pé", folga);
  if ((any || mob.includes("Transporte público")) && km <= 6 && !profile?.evitar.includes("Longos deslocamentos"))
    return legFor(km, "transporte público", folga);
  if (mob.includes("Carro")) return legFor(km, "carro", folga);
  return legFor(km, "app de transporte", folga);
}

// ------------------------------------------------------------ agenda do dia

export function dayDate(ctx: Ctx, idx: number) {
  return addDays(ctx.inicio, idx);
}

function temaOf(items: SItem[]): string {
  const count: Record<string, number> = {};
  items.forEach((i) => (count[i.poi.bairro] = (count[i.poi.bairro] ?? 0) + 1));
  const top = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => x[0]);
  return top.length ? top.join(" e ") : "Dia livre";
}

/** Calcula horários, trajetos e alertas de um dia do roteiro. */
export function sched(day: DayPlan, idx: number, ctx: Ctx): SDay {
  const date = dayDate(ctx, idx);
  const wd = weekday(date);
  let t = day.start;
  let prev: Place = ctx.hotel;
  const items: SItem[] = [];
  for (const it of day.items) {
    const poi = ctx.pois[it.p];
    if (!poi) continue;
    const tr = travel(prev, poi, ctx.profile, ctx.rules);
    t += tr.min;
    let wait = 0;
    let late = false;
    if (it.fixed) {
      const f = toMin(it.fixed);
      if (f > t) { wait = f - t; t = f; }
      else if (t > f + 5) late = true;
    }
    const abre = toMin(poi.abre);
    if (t < abre) { wait += abre - t; t = abre; }
    const ini = t;
    t += it.dur ?? poi.dur;
    const fecha = poi.fecha === "23:59" ? 24 * 60 : toMin(poi.fecha);
    const warn = poi.closedDays.includes(wd) ? "fechado" : t > fecha ? "fecha" : null;
    items.push({ ...it, poi, tr, wait, ini, fim: t, warn, late });
    prev = poi;
  }
  const back = travel(prev, ctx.hotel, ctx.profile, ctx.rules);
  const end = t + back.min;
  const walk = items.reduce((a, i) => a + (i.tr.modo === "a pé" ? i.tr.km : 0), 0) + (back.modo === "a pé" ? back.km : 0);
  const moveMin = items.reduce((a, i) => a + i.tr.min, 0) + back.min;
  return {
    idx, date, label: dayLabel(date), tema: temaOf(items), start: day.start,
    items, back, end, walk, moveMin, endFixed: day.endFixed ?? null,
  };
}

export function schedAll(days: DayPlan[], ctx: Ctx): SDay[] {
  return days.map((d, i) => sched(d, i, ctx));
}

const problems = (s: SDay) => {
  let n = s.items.filter((i) => i.warn || i.late).length;
  if (s.endFixed && s.end > toMin(s.endFixed)) n++;
  return n;
};

export const usedPois = (days: DayPlan[]) => new Set(days.flatMap((d) => d.items.map((i) => i.p)));

/** Lugares ainda fora do roteiro, do mais perto pro mais longe de ref. */
export function nearestUnused(ref: Place, filter: (p: Poi) => boolean, days: DayPlan[], ctx: Ctx): Poi[] {
  const u = usedPois(days);
  return Object.values(ctx.pois)
    .filter((p) => !u.has(p.id) && filter(p))
    .sort((a, b) => haversineKm(a, ref) - haversineKm(b, ref));
}

const matchesProfile = (p: Poi, prof: Profile) => p.tags.some((t) => prof.int.includes(t));

/** Posição em que o lugar menos aumenta o deslocamento sem criar conflito. */
export function bestInsert(day: DayPlan, idx: number, item: Item, ctx: Ctx): number {
  let best = day.items.length, bm = Infinity;
  for (let i = 0; i <= day.items.length; i++) {
    const t = clone(day);
    t.items.splice(i, 0, item);
    const s = sched(t, idx, ctx);
    const cost = s.moveMin + problems(s) * 1000;
    if (cost < bm) { bm = cost; best = i; }
  }
  return best;
}

// ------------------------------------------------------------ geração

export type Ratings = Record<string, number>; // média de nota por categoria

function score(p: Poi, ctx: Ctx, ratings: Ratings): number {
  const { profile: prof, rules: r, hotel } = ctx;
  const catTag: Record<string, string> = { Museu: "museus", Compras: "compras", Praia: "praias", Parque: "natureza", "Vida noturna": "vida noturna", Gastronomia: "gastronomia", Restaurante: "gastronomia" };
  const match = p.tags.filter((t) => prof.int.includes(t)).length + (prof.int.includes(catTag[p.cat] ?? "") ? 1 : 0);
  let s = 1 + match * (r.interesse / 100) * 3;
  const d = streetKm(hotel, p);
  if (d > r.raio) s -= (d - r.raio) * (r.desloc / 100) * 0.6;
  if (prof.evitar.includes("Filas longas") && p.reserva) s -= 0.8;
  if (prof.evitar.includes("Lugares muito turísticos") && p.reserva) s -= 0.6;
  if (prof.comp === "Família com crianças" && p.tags.includes("família")) s += 1.2;
  if (prof.comp === "Com idosos" && !p.indoor) s -= 0.3;
  if (ratings[p.cat] != null) s += (ratings[p.cat] - 3) * 0.4;
  return s;
}

export function eligible(p: Poi, ctx: Ctx): boolean {
  const { profile: prof, rules: r } = ctx;
  if (!p.active) return false;
  if (prof.orc === "Econômico" && p.preco >= 3) return false;
  if (prof.evitar.includes("Atividades caras") && p.preco >= 3) return false;
  if (p.cat === "Vida noturna" && !prof.int.includes("vida noturna") && !prof.mob.includes("Atividades noturnas")) return false;
  return streetKm(ctx.hotel, p) <= Math.max(25, r.raio * 3);
}

function centroid(ps: Place[]): Place {
  return { lat: ps.reduce((a, p) => a + p.lat, 0) / ps.length, lng: ps.reduce((a, p) => a + p.lng, 0) / ps.length };
}

/** Rota curta: vizinho mais próximo a partir do hotel e depois 2-opt. */
function orderRoute(ids: number[], ctx: Ctx): number[] {
  if (ids.length < 2) return ids.slice();
  const left = ids.slice();
  const route: number[] = [];
  let cur: Place = ctx.hotel;
  while (left.length) {
    left.sort((a, b) => haversineKm(cur, ctx.pois[a]) - haversineKm(cur, ctx.pois[b]));
    const n = left.shift()!;
    route.push(n);
    cur = ctx.pois[n];
  }
  const pt = (i: number): Place => (i < 0 || i >= route.length ? ctx.hotel : ctx.pois[route[i]]);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < route.length - 1; i++)
      for (let k = i + 1; k < route.length; k++) {
        const d0 = haversineKm(pt(i - 1), pt(i)) + haversineKm(pt(k), pt(k + 1));
        const d1 = haversineKm(pt(i - 1), pt(k)) + haversineKm(pt(i), pt(k + 1));
        if (d1 + 1e-9 < d0) {
          route.splice(i, k - i + 1, ...route.slice(i, k + 1).reverse());
          improved = true;
        }
      }
  }
  return route;
}

export type Forced = { poiId: number; dayIdx: number; time: string | null };

export type GenerateInput = {
  ctx: Ctx;
  nDays: number;
  forced: Forced[];
  /** limite do último dia, "HH:MM" (ex.: voo de volta) */
  lastDayEnd: string | null;
  ratings?: Ratings;
};

export type GenerateResult = { days: DayPlan[]; activities: number; optimizedMove: number; naiveMove: number; candidates: number };

/** Categorias que não se repetem no mesmo dia (praia ocupa meio período: três seguidas viram um dia só de praia). */
const MAX_POR_DIA: Record<string, number> = { Praia: 1 };

export function generate({ ctx, nDays, forced, lastDayEnd, ratings = {} }: GenerateInput): GenerateResult {
  const { profile: prof, rules: r } = ctx;
  const perDay = r.porRitmo[prof.ritmo] ?? 5;
  const start = prof.mob.includes("Acordar cedo") ? 540 : prof.evitar.includes("Acordar muito cedo") ? 600 : 570;
  const cand = Object.values(ctx.pois).filter((p) => eligible(p, ctx));
  const sc = new Map(cand.map((p) => [p.id, score(p, ctx, ratings)]));
  const forcedIds = new Set(forced.map((f) => f.poiId));
  const pool = cand.filter((p) => !p.meal && !forcedIds.has(p.id)).sort((a, b) => sc.get(b.id)! - sc.get(a.id)!);
  const meals = cand.filter((p) => p.meal && !forcedIds.has(p.id));

  const days: DayPlan[] = [];
  let naiveMove = 0;
  for (let d = 0; d < nDays; d++) {
    const isLast = d === nDays - 1;
    const endFixed = isLast ? lastDayEnd : null;
    const dayForced = forced.filter((f) => f.dayIdx === d && ctx.pois[f.poiId]);
    let target = perDay - (r.almoco ? 1 : 0);
    if (endFixed) target = Math.min(target, Math.max(1, Math.floor((toMin(endFixed) - start) / 130)));
    const cluster: Poi[] = dayForced.map((f) => ctx.pois[f.poiId]).filter((p) => !p.meal);
    const chosen: Poi[] = [];
    if (!cluster.length && pool.length) chosen.push(pool.shift()!);
    while (cluster.length + chosen.length < target && pool.length) {
      const c = centroid([ctx.hotel, ...cluster, ...chosen].slice(cluster.length + chosen.length ? 1 : 0));
      let bi = 0, bv = -Infinity;
      const doDia = [...cluster, ...chosen];
      pool.forEach((p, i) => {
        if ((MAX_POR_DIA[p.cat] ?? Infinity) <= doDia.filter((x) => x.cat === p.cat).length) return;
        const v = sc.get(p.id)! - streetKm(c, p) * (r.desloc / 100) * 0.9;
        if (v > bv) { bv = v; bi = i; }
      });
      if (bv === -Infinity) break; // o que sobrou estourava o limite da categoria no dia
      chosen.push(pool.splice(bi, 1)[0]);
    }
    let meal: Poi | null = null;
    const hasForcedMeal = dayForced.some((f) => ctx.pois[f.poiId].meal);
    if (r.almoco && !hasForcedMeal && meals.length) {
      const c = centroid([...cluster, ...chosen].length ? [...cluster, ...chosen] : [ctx.hotel]);
      let bi = 0, bv = -Infinity;
      meals.forEach((p, i) => {
        const v = sc.get(p.id)! * 0.3 - streetKm(c, p);
        if (v > bv) { bv = v; bi = i; }
      });
      meal = meals.splice(bi, 1)[0];
    }

    // ordem "da lista" (por nota), pra comparar com a rota otimizada
    const naive: DayPlan = { start, items: [...dayForced.map((f) => ({ p: f.poiId, fixed: f.time })), ...[...chosen, ...(meal ? [meal] : [])].map((p) => ({ p: p.id }))] };
    naiveMove += sched(fixConflicts(naive, d, ctx), d, ctx).moveMin;

    let plan: DayPlan = { start, items: orderRoute(chosen.map((p) => p.id), ctx).map((p) => ({ p })), endFixed };
    // almoço: na posição em que cai mais perto das 13h
    if (meal) {
      let best = 0, bv = Infinity;
      for (let i = 0; i <= plan.items.length; i++) {
        const t = clone(plan);
        t.items.splice(i, 0, { p: meal.id });
        const s = sched(t, d, ctx);
        const v = Math.abs(s.items[i].ini - 780) + s.moveMin * 0.5 + problems(s) * 1000;
        if (v < bv) { bv = v; best = i; }
      }
      plan.items.splice(best, 0, { p: meal.id });
    }
    // reservas do dia: entram travadas no horário
    for (const f of dayForced.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))) {
      const item: Item = { p: f.poiId, fixed: f.time };
      plan.items.splice(bestInsert(plan, d, item, ctx), 0, item);
    }
    // fugir do pico: atração disputada vai pra primeira hora, se não custar caro
    if (r.pico) {
      const i = plan.items.findIndex((it) => ctx.pois[it.p].reserva && !it.fixed);
      if (i > 0) {
        const t = clone(plan);
        const [it] = t.items.splice(i, 1);
        t.items.unshift(it);
        const a = sched(plan, d, ctx), b = sched(t, d, ctx);
        if (b.moveMin - a.moveMin <= 15 && problems(b) <= problems(a)) plan = t;
      }
    }
    plan = improve(fixConflicts(plan, d, ctx), d, ctx);
    days.push(plan);
  }
  const optimizedMove = days.reduce((a, d, i) => a + sched(d, i, ctx).moveMin, 0);
  const activities = days.reduce((a, d) => a + d.items.length, 0);
  return { days, activities, optimizedMove, naiveMove, candidates: cand.length };
}

/** Refeição sem reserva precisa cair entre 11h30 e 14h30. */
const mealOk = (s: SDay) => s.items.every((i) => !i.poi.meal || i.fixed || (i.ini >= 690 && i.ini <= 870));

/**
 * Passada final: muda paradas de posição enquanto isso encurtar o deslocamento
 * sem criar conflito nem tirar o almoço da janela.
 */
function improve(plan: DayPlan, idx: number, ctx: Ctx): DayPlan {
  let cur = plan;
  let best = sched(cur, idx, ctx);
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (let i = 0; i < cur.items.length && !changed; i++) {
      if (cur.items[i].fixed || ctx.pois[cur.items[i].p]?.meal) continue;
      for (let j = 0; j < cur.items.length; j++) {
        if (j === i) continue;
        const t = clone(cur);
        const [x] = t.items.splice(i, 1);
        t.items.splice(j, 0, x);
        const s = sched(t, idx, ctx);
        if (s.moveMin < best.moveMin - 1 && problems(s) <= problems(best) && (mealOk(s) || !mealOk(best))) {
          cur = t;
          best = s;
          changed = true;
          break;
        }
      }
    }
    if (!changed) break;
  }
  return cur;
}

/** Tira do dia o que não cabe: lugar fechado, fora do horário, ou passando do limite. */
export function fixConflicts(plan: DayPlan, idx: number, ctx: Ctx): DayPlan {
  let p = clone(plan);
  for (let guard = 0; guard < 12; guard++) {
    const s = sched(p, idx, ctx);
    const late = s.items.findIndex((i) => i.late && i.fixed);
    if (late >= 0) {
      // 1) adianta a reserva na ordem do dia, para a posição mais tardia em que ela chega a tempo
      let moved: DayPlan | null = null;
      for (let j = late - 1; j >= 0 && !moved; j--) {
        const t = clone(p);
        const [x] = t.items.splice(late, 1);
        t.items.splice(j, 0, x);
        if (!sched(t, idx, ctx).items[j].late) moved = t;
      }
      if (moved) { p = moved; continue; }
      // 2) nem em primeiro chega a tempo: vira a primeira parada e a saída do hotel fica mais cedo (até 7h)
      if (late > 0) { const [x] = p.items.splice(late, 1); p.items.unshift(x); continue; }
      const need = toMin(s.items[0].fixed!) - s.items[0].tr.min - 5;
      if (need >= 420 && need < p.start) { p.start = need; continue; }
      break;
    }
    const bad = s.items.findIndex((i) => i.warn && !i.fixed);
    if (bad >= 0) {
      const t = clone(p);
      const [it] = t.items.splice(bad, 1);
      const pos = bestInsert(t, idx, it, ctx);
      const t2 = clone(t);
      t2.items.splice(pos, 0, it);
      // só volta para o dia se não criar outro conflito (evita ficar trocando de lugar com uma reserva)
      p = problems(sched(t2, idx, ctx)) <= problems(sched(t, idx, ctx)) ? t2 : t;
      continue;
    }
    const limit = p.endFixed ? toMin(p.endFixed) : 22 * 60 + 30;
    if (s.end > limit) {
      const k = [...p.items.keys()].reverse().find((i) => !p.items[i].fixed && !ctx.pois[p.items[i].p].meal);
      if (k == null) break;
      p.items.splice(k, 1);
      continue;
    }
    break;
  }
  return p;
}

// ------------------------------------------------------------ replanejamento

export type ReplanResult = { days: DayPlan[]; msg: string; changed: boolean };

/** Troca o que é ao ar livre por opções cobertas perto, sem mexer nas reservas. */
export function rainSwap(days: DayPlan[], idx: number, ctx: Ctx): ReplanResult {
  const next = clone(days);
  const d = next[idx];
  const sw: string[] = [];
  const keep: string[] = [];
  d.items.forEach((it, i) => {
    const p = ctx.pois[it.p];
    if (p && !p.indoor && !it.fixed) {
      const alt = nearestUnused(p, (q) => q.indoor && !q.meal && eligible(q, ctx) && streetKm(p, q) <= 3, next, ctx)[0];
      if (alt) { sw.push(p.nome + " por " + alt.nome); d.items[i] = { p: alt.id }; }
      else keep.push(p.nome);
    }
  });
  next[idx] = fixConflicts(d, idx, ctx);
  return {
    days: next, changed: sw.length > 0,
    msg: (sw.length ? "Troquei " + sw.join(" e ") + ". O que tem reserva continua no horário." : keep.length ? "Não há opção coberta perto o bastante para trocar." : "As atividades desse dia já são cobertas. Nada precisou mudar.") +
      (sw.length && keep.length ? " " + keep.join(" e ") + " ficou, porque não há opção coberta perto." : ""),
  };
}

/** Começa 30 min mais tarde e tira a atividade menos importante do fim do dia. */
export function tiredAdj(days: DayPlan[], idx: number, ctx: Ctx): ReplanResult {
  const next = clone(days);
  const d = next[idx];
  d.start += 30;
  let rem: string | null = null;
  for (let i = d.items.length - 1; i >= 0; i--) {
    const p = ctx.pois[d.items[i].p];
    if (!d.items[i].fixed && !d.items[i].done && p && !p.meal) {
      rem = p.nome;
      d.items.splice(i, 1);
      break;
    }
  }
  return { days: next, changed: true, msg: "Começamos 30 minutos mais tarde" + (rem ? " e tirei " + rem + " para o dia render sem correria." : ".") };
}

/** Empurra o dia 1 hora e tira o que não couber até as reservas. */
export function lateAdj(days: DayPlan[], idx: number, ctx: Ctx): ReplanResult {
  const next = clone(days);
  const d = next[idx];
  d.start += 60;
  const dropped: string[] = [];
  const limit = d.endFixed ? toMin(d.endFixed) : 22 * 60 + 30;
  for (let g = 0; g < 10; g++) {
    const s = sched(d, idx, ctx);
    if (s.end <= limit && !s.items.some((x) => x.late)) break;
    const i = [...d.items.keys()].reverse().find((k) => !d.items[k].fixed && !d.items[k].done && !ctx.pois[d.items[k].p]?.meal);
    if (i == null) break;
    dropped.push(ctx.pois[d.items[i].p].nome);
    d.items.splice(i, 1);
  }
  return { days: next, changed: true, msg: "Empurrei o dia em 1 hora" + (dropped.length ? " e tirei " + dropped.join(", ") + " para caber nos horários reservados." : ". Tudo ainda cabe.") };
}

/** Troca até duas atividades pagas por alternativas gratuitas ou baratas parecidas. */
export function saveAdj(days: DayPlan[], idx: number, ctx: Ctx): ReplanResult {
  const next = clone(days);
  const d = next[idx];
  const ch: string[] = [];
  d.items.forEach((it, i) => {
    const p = ctx.pois[it.p];
    if (p && p.preco >= 2 && !it.fixed && !p.meal && ch.length < 2) {
      const alt = nearestUnused(p, (q) => q.preco <= 1 && !q.meal && eligible(q, ctx) && matchesProfile(q, ctx.profile), next, ctx)[0];
      if (alt) { ch.push(p.nome + " por " + alt.nome); d.items[i] = { p: alt.id }; }
    }
  });
  next[idx] = fixConflicts(d, idx, ctx);
  return {
    days: next, changed: ch.length > 0,
    msg: ch.length ? "Troquei " + ch.join(" e ") + "." : "O dia já está na faixa mais econômica possível.",
  };
}

export function removeAt(days: DayPlan[], idx: number, i: number, ctx: Ctx): ReplanResult & { alts: number[] } {
  const next = clone(days);
  const d = next[idx];
  const it = d.items[i];
  const p = ctx.pois[it.p];
  d.items.splice(i, 1);
  const refItem = d.items[Math.min(i, d.items.length - 1)];
  const ref: Place = refItem ? ctx.pois[refItem.p] : ctx.hotel;
  const alts = nearestUnused(ref, (q) => q.id !== it.p && !q.meal && matchesProfile(q, ctx.profile) && eligible(q, ctx), next, ctx).slice(0, 3).map((q) => q.id);
  return { days: next, changed: true, alts, msg: "Removi " + p.nome + ". Reorganizei os horários e separei alternativas próximas que combinam com seu perfil." };
}

export function addPoi(days: DayPlan[], idx: number, poiId: number, ctx: Ctx, fixed?: string | null): ReplanResult & { pos: number } {
  const next = clone(days);
  // se já estiver em outro dia, sai de lá
  next.forEach((d) => (d.items = d.items.filter((x) => x.p !== poiId)));
  const item: Item = fixed ? { p: poiId, fixed } : { p: poiId };
  const pos = bestInsert(next[idx], idx, item, ctx);
  next[idx].items.splice(pos, 0, item);
  return { days: next, changed: true, pos, msg: "Coloquei na posição que menos aumenta o deslocamento, como parada " + (pos + 1) + "." };
}

export function moveItem(days: DayPlan[], idx: number, i: number, dir: number, ctx: Ctx): ReplanResult | null {
  const d = days[idx];
  const j = i + dir;
  if (j < 0 || j >= d.items.length) return null;
  const next = clone(days);
  const it = next[idx].items;
  [it[i], it[j]] = [it[j], it[i]];
  const before = sched(d, idx, ctx).moveMin;
  const after = sched(next[idx], idx, ctx).moveMin;
  const diff = after - before;
  return { days: next, changed: true, msg: "Recalculei horários e trajetos. Deslocamento do dia: " + after + " min (" + (diff >= 0 ? "+" : "") + diff + " min)." };
}

/** Encaixa algo perto num intervalo livre antes da parada i. */
export function fillGap(days: DayPlan[], idx: number, i: number, ctx: Ctx): ReplanResult | null {
  const d = days[idx];
  const prev: Place = i ? ctx.pois[d.items[i - 1].p] : ctx.hotel;
  const c = nearestUnused(prev, (q) => !q.meal && eligible(q, ctx) && matchesProfile(q, ctx.profile), days, ctx);
  for (const q of c.slice(0, 8)) {
    const t = clone(d);
    t.items.splice(i, 0, { p: q.id });
    const s = sched(t, idx, ctx);
    if (!s.items.some((x) => x.warn || x.late)) {
      const next = clone(days);
      next[idx] = t;
      return { days: next, changed: true, msg: q.nome + " fica a poucos minutos da parada anterior e combina com seu perfil." };
    }
  }
  return null;
}

/** Leva atividades não concluídas pro dia seguinte, cada uma no melhor encaixe. */
export function carryOver(days: DayPlan[], idx: number, poiIds: number[], ctx: Ctx): ReplanResult {
  const next = clone(days);
  next[idx].items = next[idx].items.filter((it) => !poiIds.includes(it.p));
  const nd = next[idx + 1];
  for (const k of poiIds) nd.items.splice(bestInsert(nd, idx + 1, { p: k }, ctx), 0, { p: k });
  next[idx + 1] = fixConflicts(nd, idx + 1, ctx);
  return { days: next, changed: true, msg: poiIds.map((k) => ctx.pois[k].nome).join(" e ") + " entrou no dia seguinte. O motor reorganizou os horários a partir disso." };
}

/** As últimas atividades sem reserva e não concluídas, candidatas a ir pro dia seguinte. */
export function carryPending(day: DayPlan): number[] {
  return day.items.filter((it) => !it.fixed && !it.done).slice(-2).map((it) => it.p);
}

/** Durante a viagem: ficou mais tempo; encurta uma visita longa depois pra compensar. */
export function stayLonger(days: DayPlan[], idx: number, cur: number, ctx: Ctx): ReplanResult {
  const next = clone(days);
  const d = next[idx];
  const it = d.items[cur];
  const p = ctx.pois[it.p];
  it.dur = (it.dur ?? p.dur) + 40;
  let msg = "Você ficou 40 min a mais em " + p.nome + ". ";
  const k = ctx.rules.auto ? d.items.findIndex((x, i) => i > cur && !x.fixed && !ctx.pois[x.p].meal && (x.dur ?? ctx.pois[x.p].dur) > 45) : -1;
  if (k > 0) {
    const q = ctx.pois[d.items[k].p];
    d.items[k].dur = (d.items[k].dur ?? q.dur) - 30;
    msg += "A visita a " + q.nome + " ficou 30 min mais curta" + (d.items.some((x) => x.fixed) ? " e as reservas continuam garantidas." : ".");
  }
  next[idx] = fixConflicts(d, idx, ctx);
  return { days: next, changed: true, msg };
}

/** Durante a viagem: pula a próxima atividade (se não tiver reserva). */
export function skipItem(days: DayPlan[], idx: number, i: number, ctx: Ctx): ReplanResult | null {
  const it = days[idx].items[i];
  if (!it || it.fixed) return null;
  const next = clone(days);
  next[idx].items.splice(i, 1);
  return { days: next, changed: true, msg: "Pulei " + ctx.pois[it.p].nome + " e adiantei o resto do dia." };
}

/** Motivos de cada parada estar onde está (o "por que aqui?"). */
export function whyLines(s: SDay, i: number, ctx: Ctx, moeda: string): string[] {
  const it = s.items[i];
  const p = it.poi;
  const prev = i ? s.items[i - 1].poi.nome : "o hotel";
  const km = it.tr.km.toFixed(1).replace(".", ",");
  const why = [
    "A " + km + " km de " + prev + ", " + it.tr.min + " min " + it.tr.modo,
    it.warn === "fechado" ? "Atenção: não abre neste dia da semana" :
      p.abre === "00:00" && p.fecha === "23:59" ? "Aberto o dia todo" :
      "Aberto das " + p.abre + " às " + p.fecha + (it.warn ? ", mas o horário previsto passa do fechamento" : ", cabe com folga"),
    "Combina com: " + (p.tags.filter((t) => ctx.profile.int.includes(t)).join(", ") || "variedade para o dia"),
  ];
  if (it.fixed) why.push("Horário travado pela sua reserva das " + it.fixed);
  if (p.reserva && !it.fixed) why.push("Costuma ter fila. Recomendamos comprar antes");
  if (p.preco > 0) why.push("Faixa de preço " + moeda.repeat(p.preco));
  return why;
}
