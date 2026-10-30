import "server-only";
import type { EventoPagamento, Provedor } from "./tipos";

// Pagamento de mentira para testar o fluxo inteiro no local, sem conta na Cakto: a tela
// /app/pagamento-simulado aprova ou reembolsa e manda o aviso no mesmo formato traduzido.
// Recusado em produção (ver pagamentos/index.ts).

export const simulado: Provedor = {
  nome: "simulado",
  urlCheckout: (p) => `/app/pagamento-simulado?ref=${encodeURIComponent(p.ref)}`,
  lerAviso(corpo) {
    const c = corpo as { ref?: string; acao?: string; id?: string };
    const tipos: Record<string, EventoPagamento["tipo"]> = { pagar: "pago", reembolsar: "reembolsado", chargeback: "chargeback" };
    const tipo = tipos[c?.acao ?? ""];
    if (!tipo || typeof c.ref !== "string") return null;
    return { idEvento: `${c.acao}:${c.ref}:${c.id ?? ""}`, tipo, ref: c.ref, idExterno: "sim-" + c.ref, assinaturaExterna: null, valorCentavos: null, email: null, metodo: "simulado" };
  },
};
