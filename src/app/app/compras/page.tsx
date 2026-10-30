import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { brl } from "@/lib/planosPadrao";
import TabBar from "@/components/TabBar";
import { requireTraveler } from "@/lib/auth";
import { sql } from "@/lib/db";
import { dmy } from "@/lib/format";
import { assinaturaAtiva } from "@/lib/planos";

const STATUS: Record<string, [string, string]> = {
  aguardando: ["Aguardando pagamento", "b-sun"], pago: ["Pago", "b-sea"], revisar: ["Em conferência", "b-sun"],
  reembolsado: ["Reembolsado", "b-grey"], chargeback: ["Contestado", "b-coral"], cancelado: ["Cancelado", "b-grey"],
};

// Compras do viajante. Volta do checkout da Cakto cai aqui (?ok=1).
export default async function Compras({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const u = await requireTraveler();
  const ok = !!(await searchParams).ok;
  const [pedidos, assinatura] = await Promise.all([
    sql<{ id: number; nome: string; valor: string; status: string; created_at: Date; trip_id: number | null; destino: string | null }[]>`
      SELECT p.id, pr.nome, p.valor_centavos AS valor, p.status, p.created_at, p.trip_id, d.nome AS destino
      FROM pedidos p JOIN produtos pr ON pr.id = p.produto_id
      LEFT JOIN trips t ON t.id = p.trip_id LEFT JOIN destinations d ON d.id = t.destination_id
      WHERE p.user_id = ${u.id} ORDER BY p.created_at DESC LIMIT 50`,
    assinaturaAtiva(u.id),
  ]);
  return (
    <>
      <AppHeader title="Minhas compras" sub="Planos e assinatura" back="/app/perfil" avatar={u.avatar} />
      <div className="a-body">
        <div className="pad">
          {ok && <div className="okmsg">Recebemos o seu pedido. Assim que o pagamento for confirmado (no Pix, em segundos), a viagem é liberada.</div>}
          {assinatura && (
            <div className="box">
              <div className="box-t">{assinatura.produto.nome}<span className="badge b-sea">Ativa</span></div>
              <p className="muted" style={{ fontSize: 13 }}>Vale até {dmy(assinatura.validaAte.slice(0, 10))}. Restam {assinatura.creditosRestantes} de {assinatura.produto.creditosMes} viagens neste mês.</p>
            </div>
          )}
          {pedidos.length === 0 && <div className="empty"><b>Nenhuma compra ainda</b>Os planos aparecem aqui depois da compra.</div>}
          {pedidos.map((p) => (
            <div key={p.id} className="box">
              <div className="box-t">{p.nome}<span className={"badge " + (STATUS[p.status]?.[1] ?? "b-grey")}>{STATUS[p.status]?.[0] ?? p.status}</span></div>
              <p className="muted" style={{ fontSize: 13 }}>
                {brl(Number(p.valor))} · {dmy(p.created_at.toISOString().slice(0, 10))}
                {p.trip_id && p.destino && <> · <Link className="link" href={`/app/viagem/${p.trip_id}`}>Viagem a {p.destino}</Link></>}
              </p>
            </div>
          ))}
          <p className="muted" style={{ fontSize: 12.5 }}>Quer cancelar uma compra? Até 7 dias depois dela, ou antes da viagem começar, fale com a agência em Perfil, Ajuda e suporte.</p>
        </div>
      </div>
      <TabBar />
    </>
  );
}
