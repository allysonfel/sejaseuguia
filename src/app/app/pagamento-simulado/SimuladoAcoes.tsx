"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { toast } from "@/lib/toast";

export default function SimuladoAcoes({ refPedido, volta }: { refPedido: string; volta: string }) {
  const [busy, setBusy] = useState(false);
  async function fazer(acao: "pagar" | "reembolsar" | "chargeback") {
    setBusy(true);
    try {
      const r = await api<{ resultado: string }>("/api/pagamentos/simulado", { body: { ref: refPedido, acao } });
      toast("Aviso tratado: " + r.resultado);
      window.location.assign(volta);
      return;
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }
  return (
    <>
      <button className="btn btn-sun btn-block" disabled={busy} onClick={() => fazer("pagar")}>Aprovar pagamento</button>
      <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} disabled={busy} onClick={() => fazer("reembolsar")}>Reembolsar</button>
      <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} disabled={busy} onClick={() => fazer("chargeback")}>Contestação (chargeback)</button>
    </>
  );
}
