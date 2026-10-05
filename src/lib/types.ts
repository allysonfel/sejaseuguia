// Tipos compartilhados entre servidor e cliente.

export type Ritmo = "Tranquilo" | "Moderado" | "Intenso";

export type Profile = {
  comp: string;
  int: string[];
  ritmo: Ritmo;
  orc: string;
  mob: string[];
  evitar: string[];
};

export const DEFAULT_PROFILE: Profile = {
  comp: "Casal",
  int: ["história", "gastronomia", "cultura"],
  ritmo: "Moderado",
  orc: "Intermediário",
  mob: ["Caminhar", "Transporte público"],
  evitar: [],
};

export type Poi = {
  id: number;
  destinationId: number;
  nome: string;
  cat: string;
  bairro: string;
  lat: number;
  lng: number;
  dur: number;
  abre: string;
  fecha: string;
  /** 0 = grátis, 1 a 3 = faixa de preço */
  preco: number;
  reserva: boolean;
  indoor: boolean;
  meal: boolean;
  tags: string[];
  /** dias da semana em que fecha (0 = domingo) */
  closedDays: number[];
  tip: string | null;
  historia: string | null;
  curiosidades: string[];
  datas: { ano: string; txt: string }[];
  source: string;
  reviewedAt: string;
  active: boolean;
};

export type Destination = {
  id: number;
  nome: string;
  pais: string;
  lat: number;
  lng: number;
  moeda: string;
  updateFreq: string;
  cor1: string;
  cor2: string;
};

export type Rules = {
  desloc: number;
  interesse: number;
  folga: number;
  raio: number;
  almoco: boolean;
  pico: boolean;
  chuva: boolean;
  auto: boolean;
  porRitmo: Record<Ritmo, number>;
};

export const DEFAULT_RULES: Rules = {
  desloc: 80,
  interesse: 70,
  folga: 5,
  raio: 6,
  almoco: true,
  pico: true,
  chuva: true,
  auto: true,
  porRitmo: { Tranquilo: 3, Moderado: 5, Intenso: 6 },
};

/** Uma parada do roteiro, como fica guardada no banco. */
export type Item = {
  p: number;
  /** horário travado por reserva, "HH:MM" */
  fixed?: string | null;
  /** duração ajustada (min); sem isso vale a duração média do lugar */
  dur?: number | null;
  done?: boolean;
};

export type DayPlan = {
  /** saída do hotel, em minutos desde 00:00 */
  start: number;
  items: Item[];
  /** limite do último dia (ex.: saída pro aeroporto), "HH:MM" */
  endFixed?: string | null;
};

export type Place = { lat: number; lng: number; nome?: string };

export type Hotel = { nome: string; lat: number; lng: number };

export type ReservationType =
  | "Voo"
  | "Hotel"
  | "Transfer"
  | "Restaurante"
  | "Passeio ou ingresso"
  | "Aluguel de carro"
  | "Seguro";

export type Reservation = {
  id: number;
  tripId: number;
  tipo: ReservationType;
  nome: string;
  data: string | null;
  hora: string | null;
  codigo: string | null;
  info: string | null;
  poiId: number | null;
};

export type TripStatus = "Planejada" | "Em andamento" | "Encerrada";

export type Trip = {
  id: number;
  ownerId: number;
  destinationId: number;
  destino: string;
  pais: string;
  moeda: string;
  cor1: string;
  cor2: string;
  hotel: Hotel;
  inicio: string;
  fim: string;
  pax: number;
  days: DayPlan[];
  version: number;
  shareSlug: string;
  sharePublic: boolean;
  hideRes: boolean;
  createdAt: string;
};

export type MemberRole = "editor" | "viewer";

export type TripMember = {
  id: number;
  email: string;
  nome: string | null;
  role: MemberRole;
  userId: number | null;
};

export const STAFF_ROLES = ["Administrador", "Curador de conteúdo", "Suporte", "Financeiro"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ADMIN_MODULES = [
  ["overview", "Visão geral"],
  ["travelers", "Viajantes"],
  ["trips", "Viagens"],
  ["pois", "Pontos de interesse"],
  ["dest", "Destinos"],
  ["engine", "Motor de roteiros"],
  ["team", "Equipe e LGPD"],
] as const;
export type AdminModule = (typeof ADMIN_MODULES)[number][0];

export type Permissions = Record<StaffRole, AdminModule[]>;

export const DEFAULT_PERMISSIONS: Permissions = {
  Administrador: ADMIN_MODULES.map((m) => m[0]),
  "Curador de conteúdo": ["overview", "pois", "dest"],
  Suporte: ["overview", "travelers", "trips"],
  Financeiro: ["overview"],
};

export type ReplanKind =
  | "remove"
  | "move"
  | "add"
  | "rain"
  | "tired"
  | "late"
  | "save"
  | "fill"
  | "carry"
  | "skip"
  | "longer"
  | "reservation"
  | "undo";

export const REPLAN_LABELS: Record<ReplanKind, string> = {
  remove: "Remover atividade",
  move: "Reordenar",
  add: "Adicionar atividade",
  rain: "Chuva",
  tired: "Cansaço",
  late: "Atraso",
  save: "Economizar",
  fill: "Preencher tempo livre",
  carry: "Levar para o dia seguinte",
  skip: "Pular durante a viagem",
  longer: "Mais tempo no lugar",
  reservation: "Nova reserva",
  undo: "Desfazer",
};

export const POI_CATS = ["Atração", "Museu", "Restaurante", "Gastronomia", "Experiência", "Parque", "Compras", "Vida noturna"];
export const POI_SOURCES = ["Curadoria", "Google Places", "OpenStreetMap", "Wikidata"];
