"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "@/components/Icon";
import { api } from "@/lib/client";
import { relTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { Destination } from "@/lib/types";

const LeafletMap = dynamic(() => import("@/components/LeafletMap"), { ssr: false, loading: () => <div className="lmap" /> });

type D = Destination & { stats: { pois: number; stale: number; trips: number; reviewed: string | null } };
type Form = { id: number | null; nome: string; pais: string; lat: number | null; lng: number | null; moeda: string; updateFreq: string; cor1: string; cor2: string };
type Hit = { nome: string; endereco: string; lat: number; lng: number };
type Imp = { id: number; nome: string; raio: string; busy: boolean; res: { atracoes: number; restaurantes: number; repetidos: number; avisos: string[] } | null; err: string | null };

export default function DestAdmin({ dests, requests }: { dests: D[]; requests: { termo: string; c: number }[] }) {
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [imp, setImp] = useState<Imp | null>(null);

  const open = (d: D | null, nome = "") => {
    setErr(null);
    setHits(null);
    setForm(d ? { id: d.id, nome: d.nome, pais: d.pais, lat: d.lat, lng: d.lng, moeda: d.moeda, updateFreq: d.updateFreq, cor1: d.cor1, cor2: d.cor2 }
      : { id: null, nome, pais: "", lat: null, lng: null, moeda: "€", updateFreq: "Mensal", cor1: "#FFB21E", cor2: "#101B3B" });
  };

  async function search() {
    if (!form || form.nome.trim().length < 3) return;
    try {
      const r = await api<{ results: Hit[] }>("/api/geo/search?q=" + encodeURIComponent(form.nome + (form.pais ? ", " + form.pais : "")));
      setHits(r.results);
    } catch (e) {
      toast((e as Error).message);
    }
  }
  async function save() {
    if (!form) return;
    setBusy(true);
    setErr(null);
    try {
      if (form.id) await api("/api/admin/destinations/" + form.id, { method: "PUT", body: form });
      else {
        // Destino novo: já oferece trazer os lugares dele.
        const r = await api<{ id: number }>("/api/admin/destinations", { body: form });
        setImp({ id: r.id, nome: form.nome, raio: "8", busy: false, res: null, err: null });
      }
      if (form.id) toast("Destino salvo");
      setForm(null);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => f && { ...f, [k]: v });

  async function runImport() {
    if (!imp) return;
    setImp({ ...imp, busy: true, err: null, res: null });
    try {
      const res = await api<NonNullable<Imp["res"]>>("/api/admin/destinations/" + imp.id + "/import", { body: { raio: Number(imp.raio) } });
      setImp({ ...imp, busy: false, res });
      router.refresh();
    } catch (e) {
      setImp({ ...imp, busy: false, err: (e as Error).message });
    }
  }

  return (
    <>
      <div className="toolbar" style={{ marginBottom: 14, justifyContent: "flex-end" }}>
        <button className="btn btn-navy btn-sm" onClick={() => open(null)}><Icon name="plus" />Novo destino</button>
      </div>
      <div className="dest-grid">
        {dests.map((d) => (
          <div key={d.id} className="dest">
            <div className="art">
              <svg viewBox="0 0 300 84" preserveAspectRatio="none">
                <rect width="300" height="84" fill={d.cor2} />
                <circle cx="240" cy="30" r="40" fill={d.cor1} opacity=".85" />
                <path d="M0 70 L40 52 L70 60 L110 40 L150 58 L200 46 L260 62 L300 50 V84 H0z" fill="rgba(0,0,0,.25)" />
              </svg>
              <b>{d.nome}</b>
            </div>
            <div className="bd">
              <div className="muted" style={{ fontSize: 12 }}>{d.pais} · revisão {d.updateFreq.toLowerCase()}</div>
              <div className="m3">
                <div><small>Lugares</small><b>{d.stats.pois}</b></div>
                <div><small>Viagens</small><b>{d.stats.trips}</b></div>
                <div><small>Última revisão</small><b style={{ fontFamily: "var(--sans)", fontSize: 13 }}>{relTime(d.stats.reviewed)}</b></div>
              </div>
              {d.stats.stale > 0 && <div style={{ marginTop: 8 }}><span className="badge b-coral">{d.stats.stale} desatualizados</span></div>}
              <div className="row" style={{ marginTop: 12, gap: 8 }}>
                <Link className="btn btn-ghost btn-sm" style={{ flex: 1 }} href={"/admin/lugares?dest=" + d.id}>Ver lugares</Link>
                <button className="btn btn-ghost btn-sm" onClick={() => setImp({ id: d.id, nome: d.nome, raio: "8", busy: false, res: null, err: null })} title="Importar lugares de dados abertos"><Icon name="download" />Importar</button>
                <button className="btn btn-ghost btn-sm" onClick={() => open(d)} title="Editar" aria-label="Editar destino"><Icon name="edit" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-h"><h3>Destinos que viajantes tentaram planejar</h3></div>
        <div className="rank">
          {requests.length === 0 && <div className="r muted">Ninguém pediu um destino fora da base ainda.</div>}
          {requests.map((r) => (
            <div key={r.termo} className="r">
              <b style={{ flex: 1, fontWeight: 600 }}>{r.termo}</b>
              <span className="mono muted">{r.c} {r.c === 1 ? "pedido" : "pedidos"}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => open(null, r.termo)}>Criar destino</button>
            </div>
          ))}
        </div>
      </div>

      {imp && (
        <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && !imp.busy && setImp(null)}>
          <div className="modal">
            <div className="modal-h"><h3>Importar lugares de {imp.nome}</h3>{!imp.busy && <button onClick={() => setImp(null)} aria-label="Fechar"><Icon name="close" /></button>}</div>
            <div className="modal-b">
              {imp.err && <div className="err">{imp.err}</div>}
              {imp.res ? (
                <>
                  <div className="okmsg">
                    {imp.res.atracoes} atrações e {imp.res.restaurantes} restaurantes importados
                    {imp.res.repetidos ? " (" + imp.res.repetidos + " já existiam e ficaram de fora)" : ""}.
                  </div>
                  {imp.res.avisos.map((a) => <div key={a} className="err" style={{ background: "var(--sun-bg)", color: "#6B4A00" }}>{a}</div>)}
                  <p className="muted" style={{ fontSize: 13 }}>
                    Tudo entrou <b>desativado</b>. Revise preço, horário, reserva e dicas e libere os lugares para os roteiros.
                  </p>
                </>
              ) : (
                <>
                  <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
                    Busca as atrações mais conhecidas ao redor do centro do destino no Wikidata, com nome e história em português
                    (Wikipédia), e restaurantes perto delas no OpenStreetMap. Nada vai para os roteiros antes da revisão da equipe.
                  </p>
                  <div className="field">
                    <label>Raio a partir do centro (km)</label>
                    <input className="input mono" inputMode="numeric" value={imp.raio} disabled={imp.busy} onChange={(e) => setImp({ ...imp, raio: e.target.value.replace(/\D/g, "") })} />
                  </div>
                  {imp.busy && <div className="okmsg">Buscando lugares… pode levar até 3 minutos em cidades grandes.</div>}
                </>
              )}
            </div>
            <div className="modal-f">
              {imp.res ? (
                <>
                  <button className="btn btn-ghost" onClick={() => setImp(null)}>Fechar</button>
                  <Link className="btn btn-sun" href={"/admin/lugares?dest=" + imp.id + "&status=off"}>Revisar lugares</Link>
                </>
              ) : (
                <>
                  <button className="btn btn-ghost" onClick={() => setImp(null)} disabled={imp.busy}>{imp.busy ? "Aguarde" : "Agora não"}</button>
                  <button className="btn btn-sun" onClick={runImport} disabled={imp.busy}><Icon name="download" />{imp.busy ? "Importando…" : "Importar"}</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {form && (
        <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && setForm(null)}>
          <div className="modal">
            <div className="modal-h"><h3>{form.id ? "Editar destino" : "Novo destino"}</h3><button onClick={() => setForm(null)} aria-label="Fechar"><Icon name="close" /></button></div>
            <div className="modal-b">
              {err && <div className="err">{err}</div>}
              <div className="two">
                <div className="field"><label>Cidade</label><input className="input" value={form.nome} onChange={(e) => set("nome", e.target.value)} /></div>
                <div className="field"><label>País</label><input className="input" value={form.pais} onChange={(e) => set("pais", e.target.value)} /></div>
              </div>
              <button className="btn btn-ghost btn-sm" style={{ marginBottom: 10 }} onClick={search}><Icon name="search" />Achar no mapa</button>
              {hits && (
                <div className="box" style={{ padding: "2px 14px" }}>
                  {hits.length === 0 && <div className="near muted">Nada encontrado. Toque no mapa.</div>}
                  {hits.map((h, i) => (
                    <button key={i} className="near" onClick={() => { setForm((f) => f && { ...f, lat: h.lat, lng: h.lng }); setHits(null); }}>
                      <span className="li-m"><b>{h.nome}</b><small>{h.endereco}</small></span>
                    </button>
                  ))}
                </div>
              )}
              <LeafletMap
                center={form.lat != null && form.lng != null ? { lat: form.lat, lng: form.lng } : { lat: 20, lng: -20 }}
                zoom={form.lat != null ? 11 : 2}
                fitKey={String(form.lat) + String(form.lng)}
                markers={form.lat != null && form.lng != null ? [{ key: "c", kind: "pin", lat: form.lat, lng: form.lng }] : []}
                onMapClick={(p) => setForm((f) => f && { ...f, lat: Number(p.lat.toFixed(5)), lng: Number(p.lng.toFixed(5)) })}
              />
              <div className="two">
                <div className="field"><label>Símbolo da moeda</label><input className="input" value={form.moeda} onChange={(e) => set("moeda", e.target.value)} /></div>
                <div className="field"><label>Revisão dos lugares</label><select className="input full" value={form.updateFreq} onChange={(e) => set("updateFreq", e.target.value)}>{["Semanal", "Quinzenal", "Mensal"].map((f) => <option key={f}>{f}</option>)}</select></div>
              </div>
              <div className="two">
                <div className="field"><label>Cor principal</label><input className="input" type="color" value={form.cor1} onChange={(e) => set("cor1", e.target.value)} /></div>
                <div className="field"><label>Cor de fundo</label><input className="input" type="color" value={form.cor2} onChange={(e) => set("cor2", e.target.value)} /></div>
              </div>
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
