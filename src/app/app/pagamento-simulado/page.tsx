import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { brl } from "@/lib/planosPadrao";
import { requireTraveler } from "@/lib/auth";
import { sql } from "@/lib/db";
import { provedor } from "@/lib/pagamentos";
import SimuladoAcoes from "./SimuladoAcoes";

// Checkout de mentira (só no ambiente local, PAGAMENTOS_PROVEDOR=simulado) para testar a compra sem a Cakto.
export default async function PagamentoSimulado({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  try { if (provedor().nome !== "simulado") notFound(); } catch { notFound(); }
  const u = await requireTraveler();
  const ref = String((await searchParams).ref ?? "");
  const [p] = await sql<{ nome: string; valor: string; status: string; trip_id: number | null }[]>`
    SELECT pr.nome, p.valor_centavos AS valor, p.status, p.trip_id FROM pedidos p JOIN produtos pr ON pr.id = p.produto_id
    WHERE p.ref = ${ref} AND p.user_id = ${u.id}`;
  if (!p) notFound();
  return (
    <>
      <AppHeader title="Pagamento simulado" sub="Só no ambiente de teste" avatar={u.avatar} />
      <div className="a-body">
        <div className="pad">
          <div className="box">
            <div className="box-t">{p.nome}<b>{brl(Number(p.valor))}</b></div>
            <p className="muted" style={{ fontSize: 13 }}>Status: {p.status}. Esta tela faz o papel do checkout da Cakto.</p>
          </div>
          <SimuladoAcoes refPedido={ref} volta={p.trip_id ? `/app/viagem/${p.trip_id}` : "/app/compras"} />
        </div>
      </div>
    </>
  );
}
