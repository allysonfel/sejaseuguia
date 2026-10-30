"use client";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { api } from "@/lib/client";
import { brl, RECURSOS, type Recurso } from "@/lib/planosPadrao";
import { toast } from "@/lib/toast";

// Escolher plano para a viagem e aviso de função bloqueada (cobrança: ver lib/planos.ts).

type ProdutoTela = { id: string; nome: string; descricao: string; tipo: "avulso" | "assinatura"; precoCentavos: number; recursos: Recurso[]; creditosMes: number };
type Planos = {
  produtos: ProdutoTela[];
  assinatura: { nome: string; validaAte: string; creditosRestantes: number; recursos: Recurso[] } | null;
  acesso: { cobranca: boolean; comprados: Recurso[]; liberados: Recurso[]; abre: number } | null;
  podeComprar: boolean;
};

const dataHora = (ms: number) => new Date(ms).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function PlanosSheet({ tripId, motivo, onClose }: { tripId: number; motivo?: Recurso; onClose: () => void }) {
  const [p, setP] = useState<Planos | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    api<Planos>(`/api/planos?viagem=${tripId}`).then(setP).catch((e) => { toast((e as Error).message); onClose(); });
  }, [tripId, onClose]);

  async function comprar(produto: string) {
    setBusy(produto);
    try {
      const r = await api<{ url: string }>("/api/pedidos", { body: { produto, viagem: tripId } });
      window.location.assign(r.url);
      return;
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(null);
  }
  async function usarCredito() {
    setBusy("credito");
    try {
      await api(`/api/trips/${tripId}/credito`, { body: {} });
      toast("Pronto: a viagem foi liberada com um crédito da assinatura");
      window.location.reload();
      return;
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(null);
  }

  const avulsos = p?.produtos.filter((x) => x.tipo === "avulso") ?? [];
  const anuais = p?.produtos.filter((x) => x.tipo === "assinatura") ?? [];
  const tem = new Set(p?.acesso?.comprados ?? []);
  return (
    <>
      <div className="sheet-bg" onClick={onClose} />
      <div className="sheet planos" role="dialog" aria-label="Planos da viagem">
        <div className="grab" />
        <h3 className="serif">Planos da viagem</h3>
        {motivo && <p className="muted">{RECURSOS[motivo]} faz parte de um plano. Escolha o que combina com a sua viagem.</p>}
        {!p && <div className="planos-carregando"><span className="spin" aria-hidden />Carregando os planos…</div>}
        {p && tem.size > 0 && <p className="planos-tem"><Icon name="check" />Esta viagem já tem: {[...tem].map((r) => RECURSOS[r]).join(", ")}.</p>}
        {p && !p.podeComprar && (
          <p className="planos-aviso">Por enquanto, os planos não podem ser comprados pelo app.</p>
        )}
        {p?.assinatura && p.podeComprar && (
          <div className="plano">
            <div className="plano-t"><b>{p.assinatura.nome}</b><span className="badge b-sea">Sua assinatura</span></div>
            <p>{p.assinatura.creditosRestantes > 0 ? `Restam ${p.assinatura.creditosRestantes} ${p.assinatura.creditosRestantes === 1 ? "crédito" : "créditos"} neste mês.` : "Os créditos deste mês acabaram."}</p>
            <button className="btn btn-sun btn-block" disabled={!!busy || p.assinatura.creditosRestantes <= 0} onClick={usarCredito}>
              {busy === "credito" ? "Liberando…" : "Usar 1 crédito nesta viagem"}
            </button>
          </div>
        )}
        {p?.podeComprar && avulsos.map((x) => {
          const novos = x.recursos.filter((r) => !tem.has(r));
          return (
            <div key={x.id} className={"plano" + (motivo && x.recursos.includes(motivo) ? " plano-sug" : "")}>
              <div className="plano-t"><b>{x.nome}</b><span className="plano-preco">{brl(x.precoCentavos)}</span></div>
              <p>{x.descricao}</p>
              <ul>{x.recursos.map((r) => <li key={r}><Icon name="check" />{RECURSOS[r]}</li>)}</ul>
              <button className="btn btn-navy btn-block" disabled={!!busy || novos.length === 0} onClick={() => comprar(x.id)}>
                {novos.length === 0 ? "Já incluído" : busy === x.id ? "Abrindo o pagamento…" : "Comprar para esta viagem"}
              </button>
            </div>
          );
        })}
        {p?.podeComprar && !p.assinatura && anuais.length > 0 && (
          <>
            <div className="sec-t">Viaja bastante? Assinatura anual</div>
            {anuais.map((x) => (
              <div key={x.id} className="plano">
                <div className="plano-t"><b>{x.nome}</b><span className="plano-preco">{brl(x.precoCentavos)}/ano</span></div>
                <p>{x.descricao} Até {x.creditosMes} viagens por mês.</p>
                <button className="btn btn-ghost btn-block" disabled={!!busy} onClick={() => comprar(x.id)}>{busy === x.id ? "Abrindo o pagamento…" : "Assinar"}</button>
              </div>
            ))}
          </>
        )}
        {p?.podeComprar && <p className="muted planos-pe">Pagamento seguro pela Cakto (Pix ou cartão). As funções durante a viagem valem de 48 horas antes do 1º dia até o fim dela; o PDF fica para sempre.</p>}
      </div>
    </>
  );
}

/** No lugar de uma função que a viagem não tem (ou que ainda não abriu). */
export function Bloqueado({ recurso, acesso, onPlanos }: { recurso: Recurso; acesso: { comprados: Recurso[]; abre: number }; onPlanos: () => void }) {
  const comprado = acesso.comprados.includes(recurso);
  return (
    <div className="bloqueado">
      <span className="bloq-ic"><Icon name={comprado ? "clock" : "lock"} /></span>
      <b>{RECURSOS[recurso]}</b>
      {comprado
        ? <p>Já está no seu plano e libera em {dataHora(acesso.abre)}, 48 horas antes da viagem.</p>
        : <p>Esta função faz parte de um plano da viagem.</p>}
      {!comprado && <button className="btn btn-sun" onClick={onPlanos}>Ver planos</button>}
    </div>
  );
}
