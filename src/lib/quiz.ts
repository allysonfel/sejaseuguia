import type { IconName } from "./icons";
import type { Profile, Ritmo } from "./types";

// Quiz do cadastro: cada resposta é uma cena de viagem que mexe em partes do
// perfil. O motor de roteiros só enxerga o Profile montado no fim.

type Effect = {
  comp?: string;
  ritmo?: Ritmo;
  orc?: string;
  int?: string[];
  mob?: string[];
  evitar?: string[];
};

export type QuizOption = { id: string; label: string; hint?: string; icon: IconName; fx: Effect };
export type QuizQuestion = {
  id: string;
  title: string;
  sub: string;
  multi?: boolean;
  /** Em perguntas de várias respostas, quantas precisam ser marcadas para seguir. */
  min?: number;
  options: QuizOption[];
};
export type QuizAnswers = Record<string, string[]>;

export const QUIZ: QuizQuestion[] = [
  {
    id: "comp",
    title: "Com quem você vai explorar o mundo?",
    sub: "Muda o ritmo, as distâncias e o tipo de lugar.",
    options: [
      { id: "solo", label: "Só eu", hint: "Liberdade total de roteiro", icon: "user", fx: { comp: "Sozinho" } },
      { id: "casal", label: "Em casal", hint: "Momentos a dois", icon: "users", fx: { comp: "Casal" } },
      { id: "familia", label: "Com as crianças", hint: "Diversão para todas as idades", icon: "users", fx: { comp: "Família com crianças", int: ["família"] } },
      { id: "amigos", label: "Com amigos ou grupo", hint: "Quanto mais gente, melhor", icon: "users", fx: { comp: "Amigos ou grupo", int: ["entretenimento"] } },
      { id: "idosos", label: "Com os mais velhos", hint: "Conforto em primeiro lugar", icon: "users", fx: { comp: "Com idosos", evitar: ["Excesso de caminhada"] } },
    ],
  },
  {
    id: "manha",
    title: "Primeira manhã num lugar novo. O que você faz?",
    sub: "Vá no instinto, não tem resposta errada.",
    options: [
      { id: "cedo", label: "Saio cedinho, antes das multidões", icon: "clock", fx: { mob: ["Acordar cedo"] } },
      { id: "cafe", label: "Café demorado numa padaria de bairro", icon: "fork", fx: { int: ["gastronomia", "experiências locais"] } },
      { id: "famoso", label: "Vou direto ao cartão-postal da cidade", icon: "flag", fx: { int: ["história", "arquitetura"] } },
      { id: "dormir", label: "Durmo até tarde, estou de férias", icon: "tired", fx: { evitar: ["Acordar muito cedo"] } },
    ],
  },
  {
    id: "cenas",
    title: "Quais cenas fazem seus olhos brilharem?",
    sub: "Escolha quantas quiser. Isso pesa na escolha das atrações.",
    multi: true,
    min: 1,
    options: [
      { id: "museu", label: "Museus e galerias de arte", icon: "grid", fx: { int: ["museus", "cultura"] } },
      { id: "historia", label: "Castelos, ruínas e histórias antigas", icon: "flag", fx: { int: ["história", "arquitetura"] } },
      { id: "mercado", label: "Mercado de rua cheio de cheiros", icon: "fork", fx: { int: ["gastronomia", "experiências locais"] } },
      { id: "mirante", label: "Mirante no pôr do sol", icon: "camera", fx: { int: ["fotografia", "natureza"] } },
      { id: "praia", label: "Praia ou beira-rio", icon: "globe", fx: { int: ["praias", "natureza"] } },
      { id: "lojas", label: "Lojinhas e ruas de comércio", icon: "ticket", fx: { int: ["compras"] } },
      { id: "show", label: "Música ao vivo e bares", icon: "star", fx: { int: ["vida noturna", "entretenimento"], mob: ["Atividades noturnas"] } },
      { id: "trilha", label: "Trilha ou esporte ao ar livre", icon: "walk", fx: { int: ["esportes", "natureza"] } },
    ],
  },
  {
    id: "ritmo",
    title: "Como é o seu dia perfeito de viagem?",
    sub: "Define quantas atividades cabem por dia.",
    options: [
      { id: "tranquilo", label: "Poucas paradas, sem relógio", hint: "Até 3 atividades, com pausas longas", icon: "tired", fx: { ritmo: "Tranquilo" } },
      { id: "moderado", label: "Ver bastante, sem correria", hint: "4 a 5 atividades, com tempo para respirar", icon: "walk", fx: { ritmo: "Moderado" } },
      { id: "intenso", label: "Do café ao jantar, cada minuto conta", hint: "O máximo que o dia comportar", icon: "nav", fx: { ritmo: "Intenso" } },
    ],
  },
  {
    id: "jantar",
    title: "Hora do jantar. Onde você senta?",
    sub: "Ajuda a escolher a faixa de preço dos lugares.",
    options: [
      { id: "tasca", label: "Na tasca barata e cheia de locais", icon: "coin", fx: { orc: "Econômico", int: ["experiências locais"] } },
      { id: "bairro", label: "No restaurante charmoso de bairro", icon: "fork", fx: { orc: "Intermediário" } },
      { id: "reserva", label: "Naquele com reserva disputada", icon: "star", fx: { orc: "Premium", int: ["gastronomia"] } },
      { id: "degustacao", label: "No menu degustação com vista", icon: "spark", fx: { orc: "Luxo", int: ["luxo", "gastronomia"] } },
    ],
  },
  {
    id: "mob",
    title: "Pra ir de um lugar ao outro, você…",
    sub: "Escolha quantas quiser.",
    multi: true,
    min: 1,
    options: [
      { id: "pe", label: "Vou a pé, descobrindo as ruas", icon: "walk", fx: { mob: ["Caminhar"] } },
      { id: "metro", label: "Pego metrô, ônibus ou bonde", icon: "metro", fx: { mob: ["Transporte público"] } },
      { id: "app", label: "Chamo um táxi ou aplicativo", icon: "car", fx: { mob: ["Táxi ou aplicativo"] } },
      { id: "carro", label: "Alugo um carro", icon: "car", fx: { mob: ["Carro"] } },
    ],
  },
  {
    id: "evitar",
    title: "O que estraga uma viagem pra você?",
    sub: "O roteiro vai fugir disso. Pode pular se nada incomoda.",
    multi: true,
    min: 0,
    options: [
      { id: "filas", label: "Filas longas", icon: "late", fx: { evitar: ["Filas longas"] } },
      { id: "turistico", label: "Lugares lotados de turistas", icon: "users", fx: { evitar: ["Lugares muito turísticos"] } },
      { id: "andar", label: "Andar demais", icon: "walk", fx: { evitar: ["Excesso de caminhada"] } },
      { id: "longe", label: "Deslocamentos longos", icon: "route", fx: { evitar: ["Longos deslocamentos"] } },
      { id: "caro", label: "Atrações caras", icon: "coin", fx: { evitar: ["Atividades caras"] } },
      { id: "madrugar", label: "Acordar muito cedo", icon: "clock", fx: { evitar: ["Acordar muito cedo"] } },
    ],
  },
];

const uniq = (xs: string[]) => [...new Set(xs)];

export function buildProfile(answers: QuizAnswers): Profile {
  const p: Profile = { comp: "Casal", int: [], ritmo: "Moderado", orc: "Intermediário", mob: [], evitar: [] };
  for (const q of QUIZ) {
    for (const id of answers[q.id] ?? []) {
      const fx = q.options.find((o) => o.id === id)?.fx;
      if (!fx) continue;
      if (fx.comp) p.comp = fx.comp;
      if (fx.ritmo) p.ritmo = fx.ritmo;
      if (fx.orc) p.orc = fx.orc;
      p.int.push(...(fx.int ?? []));
      p.mob.push(...(fx.mob ?? []));
      p.evitar.push(...(fx.evitar ?? []));
    }
  }
  p.int = uniq(p.int);
  p.mob = uniq(p.mob);
  // Quem madruga de propósito não está evitando acordar cedo.
  p.evitar = uniq(p.evitar).filter((e) => !(e === "Acordar muito cedo" && p.mob.includes("Acordar cedo")));
  return p;
}

// ------------------------------------------------------------ estilo de viajante

export type Persona = { nome: string; desc: string; icon: IconName };

const STYLES: { tags: string[]; persona: Persona }[] = [
  { tags: ["gastronomia", "experiências locais"], persona: { nome: "Rota dos Sabores", icon: "fork", desc: "Você conhece um lugar pela boca. Mercados, tascas e cafés de bairro vão ganhar espaço no seu roteiro." } },
  { tags: ["história", "arquitetura", "museus", "cultura"], persona: { nome: "Rota da História", icon: "flag", desc: "Cada rua tem uma história e você quer ouvir todas. Monumentos, museus e bairros antigos vêm primeiro." } },
  { tags: ["fotografia", "natureza", "praias", "esportes"], persona: { nome: "Rota das Paisagens", icon: "camera", desc: "Você viaja atrás de vistas. Mirantes, parques e o ar livre vão guiar seus dias." } },
  { tags: ["vida noturna", "entretenimento"], persona: { nome: "Rota da Noite", icon: "star", desc: "Seu dia começa quando o sol se põe. Bares, shows e a vida noturna da cidade entram no roteiro." } },
  { tags: ["compras", "luxo"], persona: { nome: "Rota das Vitrines", icon: "ticket", desc: "Você gosta de garimpar. Ruas de comércio, lojas de autor e boas experiências entram na lista." } },
];

const RITMO_TXT: Record<Ritmo, string> = {
  Tranquilo: "Sem pressa: poucas paradas por dia, com tempo de sobra em cada uma.",
  Moderado: "No ritmo certo: bastante coisa por dia, sem correria.",
  Intenso: "A mil por hora: o máximo que o dia comportar.",
};

export function persona(p: Profile): Persona & { ritmo: string } {
  let best: Persona | null = null;
  let bestN = 0;
  for (const s of STYLES) {
    const n = s.tags.filter((t) => p.int.includes(t)).length;
    if (n > bestN) [best, bestN] = [s.persona, n];
  }
  const base = best ?? { nome: "Rota Equilibrada", icon: "compass" as IconName, desc: "Um pouco de tudo: o roteiro mistura história, sabores e paisagens." };
  return { ...base, ritmo: RITMO_TXT[p.ritmo] };
}
