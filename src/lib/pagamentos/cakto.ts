import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { EventoPagamento, Provedor } from "./tipos";

// Cakto: o viajante paga no checkout hospedado (pay.cakto.com.br/<oferta>) e a Cakto avisa no webhook.
// O aviso traz o "secret" do webhook dentro do corpo (devolvido quando o webhook é cadastrado),
// guardado em CAKTO_WEBHOOK_SECRET. Os parâmetros utm_* do link voltam no aviso: o utm_content
// leva a ref do nosso pedido (mesmo caminho usado no OQV). Formato confirmado só no exemplo de
// purchase_approved da documentação: leitura defensiva, conferir no 1º pagamento real.

type AvisoCakto = {
  event?: string;
  secret?: string;
  data?: {
    id?: string;
    subscription?: string | { id?: string } | null;
    customer?: { email?: string };
    amount?: number | string;
    paymentMethod?: string;
    utm_content?: string;
  };
};

const TIPOS: Record<string, EventoPagamento["tipo"]> = {
  purchase_approved: "pago",
  subscription_created: "pago",
  refund: "reembolsado",
  chargeback: "chargeback",
  subscription_renewed: "assinatura_renovada",
  subscription_canceled: "assinatura_cancelada",
  subscription_renewal_refused: "assinatura_cancelada",
};

function mesmoSegredo(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest(), hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export const cakto: Provedor = {
  nome: "cakto",
  urlCheckout(p) {
    if (!p.ofertaCakto) throw new Error("Produto sem oferta da Cakto configurada no painel.");
    const q = new URLSearchParams({ utm_source: "seja-seu-guia", utm_medium: "app", utm_content: p.ref, email: p.email, name: p.nome });
    return `https://pay.cakto.com.br/${encodeURIComponent(p.ofertaCakto)}?${q}`;
  },
  lerAviso(corpo) {
    const segredo = process.env.CAKTO_WEBHOOK_SECRET;
    const a = corpo as AvisoCakto;
    if (!segredo || typeof a?.secret !== "string" || !mesmoSegredo(a.secret, segredo)) return null;
    const d = a.data ?? {};
    const sub = typeof d.subscription === "string" ? d.subscription : d.subscription?.id ?? null;
    const valor = Number(d.amount);
    const ref = typeof d.utm_content === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(d.utm_content) ? d.utm_content : null;
    return {
      idEvento: `${a.event ?? "?"}:${d.id ?? ""}`,
      tipo: TIPOS[a.event ?? ""] ?? "ignorar",
      ref,
      idExterno: d.id ?? null,
      assinaturaExterna: sub,
      valorCentavos: Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) : null,
      email: d.customer?.email?.toLowerCase() ?? null,
      metodo: d.paymentMethod ?? null,
    };
  },
};
