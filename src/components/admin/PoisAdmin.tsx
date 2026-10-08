"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "@/components/Icon";
import { api } from "@/lib/client";
import { priceTxt } from "@/lib/format";
import { daysSinceReview, isStale } from "@/lib/stale";
import { toast } from "@/lib/toast";
import { POI_CATS, POI_SOURCES, type Destination, type Poi } from "@/lib/types";

const LeafletMap = dynamic(() => import("@/components/LeafletMap"), { ssr: false, loading: () => <div className="lmap" /> });

const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const SRC_BADGE: Record<string, string> = { Curadoria: "b-violet", "Google Places": "b-navy", OpenStreetMap: "b-grey", Wikidata: "b-sea" };

type Form = {
  id: number | null; nome: string; cat: string; bairro: string; lat: number | null; lng: number | null; dur: string;
  abre: string; fecha: string; preco: number; reserva: boolean; indoor: boolean; meal: boolean; tags: string;
  closedDays: number[]; tip: string; historia: string; curiosidades: string; datas: string; source: string; active: boolean;
};

const toForm = (p: Poi | null): Form => p ? {
  id: p.id, nome: p.nome, cat: p.cat, bairro: p.bairro, lat: p.lat, lng: p.lng, dur: String(p.dur), abre: p.abre, fecha: p.fecha,
  preco: p.preco, reserva: p.reserva, indoor: p.indoor, meal: p.meal, tags: p.tags.join(", "), closedDays: p.closedDays,
  tip: p.tip ?? "", historia: p.historia ?? "", curiosidades: p.curiosidades.join("\n"),
  datas: p.datas.map((d) => d.ano + " - " + d.txt).join("\n"), source: p.source, active: p.active,
} : {
  id: null, nome: "", cat: "Atração", bairro: "", lat: null, lng: null, dur: "60", abre: "09:00", fecha: "18:00", preco: 1,
  reserva: false, indoor: true, meal: false, tags: "", closedDays: [], tip: "", historia: "", curiosidades: "", datas: "",
  source: "Curadoria", active: true,
};

type Props = { destinations: Destination[]; dest: Destination; pois: Poi[]; cat: string; q: string; status: string };

export default function PoisAdmin({ destinations, dest, pois, cat, q, status }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const go = (o: Partial<{ dest: number; cat: string; q: string; status: string }>) => {
    const p = new URLSearchParams({ dest: String(o.dest ?? dest.id) });
    const c = o.cat ?? cat, s = o.status ?? status, qq = o.q ?? q;
    if (c !== "Todas") p.set("cat", c);
    if (s) p.set("status", s);
    if (qq) p.set("q", qq);
    router.push("/admin/lugares?" + p);
  };

  const list = pois.filter((p) =>
    (cat === "Todas" || p.cat === cat) &&
    (!q || p.nome.toLowerCase().includes(q.toLowerCase())) &&
    (!status || (status === "stale" ? p.active && isStale(p) : status === "off" ? !p.active : true)));
  const stale = pois.filter((p) => p.active && isStale(p)).length;

  async function quick(p: Poi, body: { review?: boolean; active?: boolean }, msg: string) {
    try {
      await api("/api/admin/pois/" + p.id, { method: "PATCH", body });
      toast(msg);
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function discard(p: Poi) {
    if (!confirm("Descartar " + p.nome + "? Ele sai da lista e não volta nas próximas importações.")) return;
    try {
      await api("/api/admin/pois/" + p.id, { method: "DELETE" });
      toast(p.nome + " descartado");
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  // Libera de uma vez o que está na lista filtrada (ex.: os importados, depois da revisão).
  async function bulkActivate(ids: number[]) {
    if (!confirm("Liberar " + ids.length + " lugares para os roteiros? Confira se você revisou todos.")) return;
    try {
      await api("/api/admin/pois/bulk", { method: "PATCH", body: { ids, active: true } });
      toast(ids.length + " lugares liberados para os roteiros");
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function save() {
    if (!form) return;
    setBusy(true);
    setErr(null);
    try {
      const body = { ...form, destinationId: dest.id };
      if (form.id) await api("/api/admin/pois/" + form.id, { method: "PUT", body });
      else await api("/api/admin/pois", { body });
      toast(form.id ? "Lugar salvo e revisado" : "Lugar criado e liberado para os roteiros");
      setForm(null);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => f && { ...f, [k]: v });

  return (
    <>
      <div className="toolbar" style={{ marginBottom: 14 }}>
        <select className="input" value={dest.id} onChange={(e) => go({ dest: Number(e.target.value), cat: "Todas", q: "", status: "" })}>
          {destinations.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>
        {["Todas", ...POI_CATS].map((c) => <button key={c} className={"chip " + (cat === c ? "on" : "")} onClick={() => go({ cat: c })}>{c}</button>)}
      </div>
      <div className="toolbar" style={{ marginBottom: 14 }}>
        <form className="tsearch" onSubmit={(e) => { e.preventDefault(); go({ q: String(new FormData(e.currentTarget).get("q") ?? "") }); }}>
          <Icon name="search" /><input name="q" placeholder="Buscar lugar" defaultValue={q} />
        </form>
        <button className={"chip " + (status === "" ? "on" : "")} onClick={() => go({ status: "" })}>Todos</button>
        <button className={"chip " + (status === "stale" ? "on" : "")} onClick={() => go({ status: "stale" })}>Desatualizados ({stale})</button>
        <button className={"chip " + (status === "off" ? "on" : "")} onClick={() => go({ status: "off" })}>Desativados</button>
        <span style={{ flex: 1 }} />
        {status === "off" && list.length > 0 && (
          <button className="btn btn-sun btn-sm" onClick={() => bulkActivate(list.map((p) => p.id))}><Icon name="check" />Liberar {list.length}</button>
        )}
        <button className="btn btn-navy btn-sm" onClick={() => { setErr(null); setForm(toForm(null)); }}><Icon name="plus" />Novo lugar</button>
      </div>
      <div className="panel">
        <div className="tw">
          <table>
            <thead>
              <tr><th>Lugar</th><th>Categoria</th><th>Bairro</th><th>Funcionamento</th><th className="num">Duração</th><th>Preço</th><th>Fonte</th><th>Revisado</th><th></th></tr>
            </thead>
            <tbody>
              {list.length === 0 && <tr className="empty-row"><td colSpan={9}>Nenhum lugar com esses filtros.</td></tr>}
              {list.map((p) => {
                const age = daysSinceReview(p);
                return (
                  <tr key={p.id} style={p.active ? undefined : { opacity: 0.55 }}>
                    <td><b>{p.nome}</b>{p.reserva && <span className="badge b-sun" style={{ marginLeft: 6 }}>Reserva</span>}{!p.active && <span className="badge b-grey" style={{ marginLeft: 6 }}>Desativado</span>}{p.revisado === false && <span className="badge b-violet" style={{ marginLeft: 6 }} title="Entrou sozinho quando um viajante escolheu o destino. Já aparece nos roteiros.">Automático</span>}</td>
                    <td>{p.cat}</td>
                    <td className="muted">{p.bairro}</td>
                    <td className="mono">{p.abre === "00:00" && p.fecha === "23:59" ? "Livre" : p.abre + " às " + p.fecha}{p.horarioEstimado && <span className="muted" title="Horário padrão da categoria: confira"> (estimado)</span>}{p.closedDays.length ? <span className="muted"> · fecha {p.closedDays.map((d) => WD[d]).join(", ")}</span> : null}</td>
                    <td className="num">{p.dur} min</td>
                    <td>{priceTxt(p.preco, dest.moeda)}</td>
                    <td><span className={"badge " + (SRC_BADGE[p.source] ?? "b-grey")}>{p.source}</span></td>
                    <td>{isStale(p) ? <span className="badge b-coral">Há {age} dias</span> : <span className="muted">{age === 0 ? "Hoje" : "Há " + age + " dias"}</span>}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {(isStale(p) || p.revisado === false) && p.active && <button className="btn btn-ghost btn-sm" onClick={() => quick(p, { review: true }, p.nome + " revisado e de volta às sugestões")}><Icon name="check" />Revisado</button>}{" "}
                      <button className="btn btn-ghost btn-sm" onClick={() => { setErr(null); setForm(toForm(p)); }} title="Editar" aria-label="Editar"><Icon name="edit" /></button>{" "}
                      <button className="btn btn-ghost btn-sm" onClick={() => quick(p, { active: !p.active }, p.active ? "Lugar desativado" : "Lugar ativado")} title={p.active ? "Desativar" : "Ativar"}>{p.active ? "Desativar" : "Ativar"}</button>
                      {!p.active && p.source !== "Curadoria" && <>{" "}<button className="btn btn-ghost btn-sm" onClick={() => discard(p)} title="Descartar" aria-label="Descartar"><Icon name="trash" /></button></>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && setForm(null)}>
          <div className="modal" style={{ maxWidth: 620 }}>
            <div className="modal-h"><h3>{form.id ? "Editar lugar" : "Novo lugar em " + dest.nome}</h3><button onClick={() => setForm(null)} aria-label="Fechar"><Icon name="close" /></button></div>
            <div className="modal-b">
              {err && <div className="err">{err}</div>}
              <div className="field"><label>Nome</label><input className="input" value={form.nome} onChange={(e) => set("nome", e.target.value)} /></div>
              <div className="two">
                <div className="field"><label>Categoria</label><select className="input full" value={form.cat} onChange={(e) => set("cat", e.target.value)}>{POI_CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
                <div className="field"><label>Bairro</label><input className="input" value={form.bairro} onChange={(e) => set("bairro", e.target.value)} /></div>
              </div>
              <div className="field" style={{ marginBottom: 6 }}><label>Localização (toque no mapa)</label></div>
              <LeafletMap
                center={form.lat != null && form.lng != null ? { lat: form.lat, lng: form.lng } : dest}
                zoom={form.lat != null ? 16 : 12}
                markers={form.lat != null && form.lng != null ? [{ key: "p", kind: "pin", lat: form.lat, lng: form.lng }] : []}
                onMapClick={(p) => setForm((f) => f && { ...f, lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) })}
              />
              <div className="two">
                <div className="field"><label>Abre</label><input className="input mono" type="time" value={form.abre} onChange={(e) => set("abre", e.target.value)} /></div>
                <div className="field"><label>Fecha</label><input className="input mono" type="time" value={form.fecha} onChange={(e) => set("fecha", e.target.value)} /></div>
              </div>
              <div className="field">
                <label>Fecha nos dias</label>
                <div className="chips">{WD.map((d, i) => <button key={d} type="button" className={"chip " + (form.closedDays.includes(i) ? "on" : "")} onClick={() => set("closedDays", form.closedDays.includes(i) ? form.closedDays.filter((x) => x !== i) : [...form.closedDays, i])}>{d}</button>)}</div>
              </div>
              <div className="two">
                <div className="field"><label>Duração média (min)</label><input className="input mono" inputMode="numeric" value={form.dur} onChange={(e) => set("dur", e.target.value)} /></div>
                <div className="field"><label>Faixa de preço</label><select className="input full" value={form.preco} onChange={(e) => set("preco", Number(e.target.value))}>{[0, 1, 2, 3].map((n) => <option key={n} value={n}>{priceTxt(n, dest.moeda)}</option>)}</select></div>
              </div>
              <div className="chips" style={{ marginBottom: 14 }}>
                <button type="button" className={"chip " + (form.indoor ? "on" : "")} onClick={() => set("indoor", !form.indoor)}>Coberto</button>
                <button type="button" className={"chip " + (form.meal ? "on" : "")} onClick={() => set("meal", !form.meal)}>Serve refeição</button>
                <button type="button" className={"chip " + (form.reserva ? "on" : "")} onClick={() => set("reserva", !form.reserva)}>Costuma ter fila / pedir reserva</button>
                <button type="button" className={"chip " + (form.active ? "on" : "")} onClick={() => set("active", !form.active)}>Ativo nas sugestões</button>
              </div>
              <div className="field"><label>Interesses que combinam (separados por vírgula)</label><input className="input" value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="história, arquitetura, fotografia" /></div>
              <div className="field"><label>Dica da curadoria</label><input className="input" value={form.tip} onChange={(e) => set("tip", e.target.value)} placeholder="Ex.: chegar antes das 10h evita fila" /></div>
              <div className="field"><label>História (aparece no O que é?)</label><textarea className="input" value={form.historia} onChange={(e) => set("historia", e.target.value)} /></div>
              <div className="field"><label>Curiosidades (uma por linha)</label><textarea className="input" value={form.curiosidades} onChange={(e) => set("curiosidades", e.target.value)} /></div>
              <div className="field"><label>Datas (uma por linha, ex.: 1514 - Início da obra)</label><textarea className="input" value={form.datas} onChange={(e) => set("datas", e.target.value)} /></div>
              <div className="field"><label>Fonte</label><select className="input full" value={form.source} onChange={(e) => set("source", e.target.value)}>{POI_SOURCES.map((s) => <option key={s}>{s}</option>)}</select></div>
            </div>
            <div className="modal-f">
              <button className="btn btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn btn-sun" onClick={save} disabled={busy}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
