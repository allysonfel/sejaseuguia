import Topbar from "@/components/admin/Topbar";
import VendasAdmin from "@/components/admin/VendasAdmin";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { cobrancaAtiva, listarProdutos } from "@/lib/planos";
import { brl } from "@/lib/planosPadrao";

const STATUS: Record<string, string> = { aguardando: "b-sun", pago: "b-sea", revisar: "b-coral", reembolsado: "b-grey", chargeback: "b-coral", cancelado: "b-grey" };

// Vendas: resumo do mês, pedidos e os planos à venda (preço, oferta da Cakto, ativo).
export default async function Vendas() {
  await requireStaff("sales");
  const [produtos, [mes], pedidos] = await Promise.all([
    listarProdutos(false),
    sql<{ receita: string | null; pagos: number; reembolsos: number; aguardando: number }[]>`
      SELECT sum(coalesce(pago_centavos, valor_centavos)) FILTER (WHERE status = 'pago') AS receita,
             count(*) FILTER (WHERE status = 'pago')::int AS pagos,
             count(*) FILTER (WHERE status IN ('reembolsado','chargeback'))::int AS reembolsos,
             count(*) FILTER (WHERE status IN ('aguardando','revisar'))::int AS aguardando
      FROM pedidos WHERE created_at >= date_trunc('month', now())`,
    sql<{ id: number; produto: string; valor: string; status: string; provedor: string; metodo: string | null; created_at: Date; viajante: string | null; destino: string | null }[]>`
      SELECT p.id, pr.nome AS produto, p.valor_centavos AS valor, p.status, p.provedor, p.metodo, p.created_at,
             u.nome AS viajante, d.nome AS destino
      FROM pedidos p JOIN produtos pr ON pr.id = p.produto_id
      LEFT JOIN users u ON u.id = p.user_id LEFT JOIN trips t ON t.id = p.trip_id LEFT JOIN destinations d ON d.id = t.destination_id
      ORDER BY p.created_at DESC LIMIT 100`,
  ]);
  return (
    <>
      <Topbar title="Vendas" />
      <div className="content">
        {!cobrancaAtiva() && (
          <div className="panel" style={{ padding: 16 }}>
            <b>Cobrança desligada.</b> O app está liberado para todos. Para ligar, configure a Cakto e a variável COBRANCA_ATIVA=1 no servidor.
          </div>
        )}
        <div className="kpis">
          <div className="kpi hero"><small>Receita do mês</small><b>{brl(Number(mes?.receita ?? 0))}</b></div>
          <div className="kpi"><small>Vendas pagas</small><b>{mes?.pagos ?? 0}</b></div>
          <div className="kpi"><small>Aguardando ou em conferência</small><b>{mes?.aguardando ?? 0}</b></div>
          <div className="kpi"><small>Reembolsos e contestações</small><b>{mes?.reembolsos ?? 0}</b></div>
        </div>
        <VendasAdmin produtos={produtos} />
        <div className="panel">
          <div className="panel-h"><b>Pedidos recentes</b></div>
          <div className="tw">
            <table>
              <thead><tr><th>Data</th><th>Viajante</th><th>Plano</th><th>Viagem</th><th className="num">Valor</th><th>Pagamento</th><th>Status</th></tr></thead>
              <tbody>
                {pedidos.length === 0 && <tr className="empty-row"><td colSpan={7}>Nenhum pedido ainda.</td></tr>}
                {pedidos.map((p) => (
                  <tr key={p.id}>
                    <td className="mono muted">{p.created_at.toLocaleDateString("pt-BR")}</td>
                    <td>{p.viajante ?? "Conta excluída"}</td>
                    <td><b>{p.produto}</b></td>
                    <td>{p.destino ?? "-"}</td>
                    <td className="num">{brl(Number(p.valor))}</td>
                    <td className="muted">{p.metodo ?? p.provedor}</td>
                    <td><span className={"badge " + (STATUS[p.status] ?? "b-grey")}>{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
