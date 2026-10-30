// Recursos que a cobrança libera e os produtos iniciais (proposta do Clayton, 2026-10-19).
// Preço, nome, oferta da Cakto e ativo/inativo mudam no painel (Vendas); isto só entra na 1ª carga.

export const RECURSOS = {
  pdf: "Roteiro em PDF",
  mapa: "Mapa com a sua localização e Explorar",
  modo_viagem: "Modo viagem",
  assistente: "Assistente com inteligência artificial",
  foto: "O que é? pela foto",
} as const;
export type Recurso = keyof typeof RECURSOS;
export const LISTA_RECURSOS = Object.keys(RECURSOS) as Recurso[];

/** Funções que dependem de internet e custam por uso: só valem de 48 h antes da viagem até o fim dela. O PDF vale para sempre. */
export const RECURSOS_DA_VIAGEM: Recurso[] = ["mapa", "modo_viagem", "assistente", "foto"];
export const HORAS_ANTES = 48;

export type ProdutoPadrao = {
  id: string; nome: string; descricao: string; tipo: "avulso" | "assinatura";
  preco_centavos: number; recursos: Recurso[]; creditos_mes: number; ordem: number;
};

export const PRODUTOS_PADRAO: ProdutoPadrao[] = [
  { id: "roteiro-pdf", nome: "Roteiro em PDF", descricao: "O roteiro completo em PDF, para guardar e consultar quando quiser.", tipo: "avulso", preco_centavos: 1888, recursos: ["pdf"], creditos_mes: 0, ordem: 1 },
  { id: "roteiro-mapa", nome: "PDF + mapa", descricao: "O PDF e, durante a viagem, o mapa com a sua localização e o Modo viagem.", tipo: "avulso", preco_centavos: 2888, recursos: ["pdf", "mapa", "modo_viagem"], creditos_mes: 0, ordem: 2 },
  { id: "roteiro-completo", nome: "Completo", descricao: "Tudo: PDF, mapa, Modo viagem, assistente com inteligência artificial e o O que é? pela foto.", tipo: "avulso", preco_centavos: 3888, recursos: ["pdf", "mapa", "modo_viagem", "assistente", "foto"], creditos_mes: 0, ordem: 3 },
  { id: "anual-pdf", nome: "Assinatura anual: PDF", descricao: "Um ano de roteiros em PDF.", tipo: "assinatura", preco_centavos: 18888, recursos: ["pdf"], creditos_mes: 11, ordem: 11 },
  { id: "anual-mapa", nome: "Assinatura anual: PDF + mapa", descricao: "Um ano de roteiros com PDF, mapa e Modo viagem.", tipo: "assinatura", preco_centavos: 28888, recursos: ["pdf", "mapa", "modo_viagem"], creditos_mes: 11, ordem: 12 },
  { id: "anual-completo", nome: "Assinatura anual: completo", descricao: "Um ano de roteiros com todas as funções.", tipo: "assinatura", preco_centavos: 38800, recursos: ["pdf", "mapa", "modo_viagem", "assistente", "foto"], creditos_mes: 11, ordem: 13 },
];

export const brl = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
