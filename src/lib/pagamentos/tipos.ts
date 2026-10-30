// Formato comum dos provedores de pagamento (Cakto hoje; simulado para testar no local).

export type PedidoParaCheckout = { ref: string; valorCentavos: number; produtoNome: string; ofertaCakto: string | null; email: string; nome: string };

/** Aviso do provedor já traduzido. "ignorar" é aviso que não muda nada (checkout aberto, abandonado...). */
export type EventoPagamento = {
  idEvento: string;
  tipo: "pago" | "reembolsado" | "chargeback" | "assinatura_renovada" | "assinatura_cancelada" | "ignorar";
  /** ref do nosso pedido, quando o provedor devolve (link de checkout). */
  ref: string | null;
  idExterno: string | null;
  assinaturaExterna: string | null;
  valorCentavos: number | null;
  email: string | null;
  metodo: string | null;
};

export interface Provedor {
  nome: "cakto" | "simulado";
  /** Endereço para onde o viajante vai pagar. */
  urlCheckout(p: PedidoParaCheckout): string;
  /** Confere a autenticidade do aviso e traduz. null = aviso inválido (responder 401). */
  lerAviso(corpo: unknown): EventoPagamento | null;
}
