"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import type { Produto } from "@/lib/planos";
import { brl, RECURSOS } from "@/lib/planosPadrao";
import { toast } from "@/lib/toast";

// Planos à venda: a agência muda nome, preço, oferta da Cakto e se aparece no app.
export default function VendasAdmin({ produtos: iniciais }: { produtos: Produto[] }) {
  const [produtos, setProdutos] = useState(iniciais);
  const [edit, setEdit] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", preco: "", oferta: "", ativo: true });

  function abrir(p: Produto) {
    setEdit(p.id);
    setForm({ nome: p.nome, preco: (p.precoCentavos / 100).toFixed(2).replace(".", ","), oferta: p.ofertaCakto ?? "", ativo: p.ativo });
  }
  async function salvar(id: string) {
    const precoCentavos = Math.round(Number(form.preco.replace(/\./g, "").replace(",", ".")) * 100);
    try {
      const r = await api<{ produto: Produto }>(`/api/admin/produtos/${id}`, { method: "PUT", body: { nome: form.nome, precoCentavos, ofertaCakto: form.oferta, ativo: form.ativo } });
      setProdutos((l) => l.map((p) => (p.id === id ? r.produto : p)));
      setEdit(null);
      toast("Plano salvo");
    } catch (e) {
      toast((e as Error).message);
    }
  }

  return (
    <div className="panel">
      <div className="panel-h">
        <b>Planos à venda</b>
        <small className="muted">A oferta da Cakto é o código no fim do link de pagamento (pay.cakto.com.br/código).</small>
      </div>
      <div className="tw">
        <table>
          <thead><tr><th>Plano</th><th>Inclui</th><th className="num">Preço</th><th>Oferta da Cakto</th><th>No app</th><th /></tr></thead>
          <tbody>
            {produtos.map((p) => edit === p.id ? (
              <tr key={p.id}>
                <td><input className="input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} maxLength={80} aria-label="Nome do plano" /></td>
                <td className="muted" style={{ whiteSpace: "normal", minWidth: 220, maxWidth: 360 }}>{p.recursos.map((r) => RECURSOS[r]).join(", ")}</td>
                <td className="num"><input className="input mono" style={{ width: 110 }} value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} inputMode="decimal" aria-label="Preço" /></td>
                <td><input className="input mono" value={form.oferta} onChange={(e) => setForm({ ...form, oferta: e.target.value })} maxLength={80} placeholder="código da oferta" aria-label="Oferta da Cakto" /></td>
                <td><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} aria-label="Aparece no app" /></td>
                <td><button className="btn btn-navy btn-sm" onClick={() => salvar(p.id)}>Salvar</button> <button className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>Cancelar</button></td>
              </tr>
            ) : (
              <tr key={p.id}>
                <td><b>{p.nome}</b><br /><small className="muted">{p.tipo === "assinatura" ? `Assinatura anual, ${p.creditosMes} viagens por mês` : "Avulso, por viagem"}</small></td>
                <td className="muted" style={{ whiteSpace: "normal", minWidth: 220, maxWidth: 360 }}>{p.recursos.map((r) => RECURSOS[r]).join(", ")}</td>
                <td className="num">{brl(p.precoCentavos)}</td>
                <td className="mono muted">{p.ofertaCakto ?? <span className="badge b-sun">falta configurar</span>}</td>
                <td>{p.ativo ? <span className="badge b-sea">Sim</span> : <span className="badge b-grey">Não</span>}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => abrir(p)}>Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
