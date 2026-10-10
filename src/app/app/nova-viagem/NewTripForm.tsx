"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/Icon";
import Gui from "@/components/quiz/Gui";
import TripArt from "@/components/TripArt";
import { api } from "@/lib/client";
import { eligible, travel } from "@/lib/engine";
import { addDays, daysBetween } from "@/lib/format";
import { somAcerto } from "@/lib/sons";
import { toast } from "@/lib/toast";
import { useArrastar } from "@/lib/useArrastar";
import { DEFAULT_RULES, type Destination, type DestinoBusca, type ImportStatus, type Poi, type Profile, type Regiao } from "@/lib/types";

const LeafletMap = dynamic(() => import("@/components/LeafletMap"), { ssr: false, loading: () => <div className="lmap" /> });

type Hit = { nome: string; endereco: string; lat: number; lng: number };
type Busca = { regioes: Regiao[]; cidades: DestinoBusca[]; titulo?: string };
type Preparo = { status: ImportStatus | null; lugares: number; posicao: number };

// Etapas mostradas enquanto os lugares de um destino novo são importados (o servidor leva ~1 min).
const ETAPAS_PREPARO: [number, string][] = [
  [0, "Procurando as atrações mais famosas"],
  [12, "Buscando restaurantes e cafés por perto"],
  [26, "Conferindo horários de funcionamento"],
  [40, "Traduzindo as histórias dos lugares"],
  [60, "Quase lá, organizando tudo"],
];

const rotulo = (d: Destination) => d.nome + ", " + (d.uf ? d.uf + ", " : "") + d.pais;

export default function NewTripForm({ destinations, profile, today }: { destinations: Destination[]; profile: Profile; today: string }) {
  const carrossel = useArrastar<HTMLDivElement>();
  const router = useRouter();
  const [dest, setDest] = useState<DestinoBusca | null>(destinations[0] ? { ...destinations[0], pronto: true, importStatus: null } : null);
  // destino do catálogo sem lugares: importação automática em andamento
  const [prep, setPrep] = useState<Preparo | null>(null);
  const [destTxt, setDestTxt] = useState(destinations[0] ? rotulo(destinations[0]) : "");
  const [achados, setAchados] = useState<Busca | null>(null);
  const buscaId = useRef(0);
  // busca no catálogo em andamento (texto digitado ou estado/país aberto)
  const [buscando, setBuscando] = useState<string | null>(null);
  const [ini, setIni] = useState(addDays(today, 14));
  const [fim, setFim] = useState(addDays(today, 17));
  const [hotelNome, setHotelNome] = useState("");
  const [hotel, setHotel] = useState<{ lat: number; lng: number } | null>(null);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const hotelBusca = useRef(0);
  const [pax, setPax] = useState(2);
  const [pois, setPois] = useState<Poi[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [gen, setGen] = useState<number | null>(null);
  const [requested, setRequested] = useState(false);
  // segundos desde que começou a preparar o destino (barra de progresso estimada)
  const [seg, setSeg] = useState(0);
  const preparoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dest) return;
    let live = true;
    api<{ pois: Poi[] }>("/api/destinations/" + dest.id + "/pois").then((r) => live && setPois(r.pois)).catch(() => {});
    return () => { live = false; };
  }, [dest]);

  // Destino sem lugares: pede a importação e acompanha a cada 3 s até ficar pronto (ou falhar).
  const destId = dest?.id, destPronto = dest?.pronto;
  useEffect(() => {
    if (!destId || destPronto) return;
    let live = true, timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async (primeira: boolean) => {
      try {
        const e = await api<Preparo>(`/api/destinations/${destId}/preparar`, primeira ? { body: {} } : undefined);
        if (!live) return;
        setPrep(e);
        if (e.status === "pronto" || e.status === "poucos") {
          setDest((d) => (d && d.id === destId ? { ...d, pronto: true, importStatus: e.status } : d));
          if (e.status === "poucos") toast("Encontramos poucos lugares por lá: o roteiro pode ficar mais curto");
          else if (!primeira) { somAcerto(); toast(`Pronto! ${e.lugares} lugares encontrados. Já dá para montar o roteiro`); }
          return;
        }
        if (e.status === "falhou") return;
      } catch (err) {
        if (!live) return;
        setPrep({ status: "falhou", lugares: 0, posicao: 0 });
        toast((err as Error).message);
        return;
      }
      timer = setTimeout(() => tick(false), 3000);
    };
    tick(true);
    const t0 = Date.now();
    const relogio = setInterval(() => setSeg(Math.round((Date.now() - t0) / 1000)), 1000);
    // leva a pessoa até o aviso de preparo, para ela ver que algo está acontecendo
    const rolar = setTimeout(() => preparoRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
    return () => { live = false; clearTimeout(timer); clearInterval(relogio); clearTimeout(rolar); setSeg(0); };
  }, [destId, destPronto]);

  function pickDest(d: DestinoBusca | null) {
    if (d?.id !== dest?.id) { setHotel(null); setHits(null); setPois([]); setPrep(null); }
    setDest(d);
    setRequested(false);
    if (d) { setDestTxt(rotulo(d)); setAchados(null); }
    // conta a escolha para o ranking do painel (destino sem lugares já conta ao pedir a importação)
    if (d?.pronto) api(`/api/destinations/${d.id}/preparar`, { body: {} }).catch(() => {});
  }

  // Busca no catálogo de destinos enquanto digita (cidades, países e estados).
  function digitar(txt: string) {
    setDestTxt(txt);
    if (dest && txt !== rotulo(dest)) pickDest(null);
    const id = ++buscaId.current;
    if (txt.trim().length < 2) { setBuscando(null); return setAchados(null); }
    setBuscando(txt.trim());
    setTimeout(async () => {
      if (id !== buscaId.current) return;
      const r = await api<Busca>("/api/destinations/search?q=" + encodeURIComponent(txt.trim())).catch(() => null);
      if (id !== buscaId.current) return;
      setBuscando(null);
      if (r) setAchados(r);
      else toast("Não deu para buscar agora. Confira a conexão e tente de novo");
    }, 250);
  }

  async function abrirRegiao(r: Regiao) {
    const id = ++buscaId.current;
    setBuscando(r.nome);
    const res = await api<Busca>("/api/destinations/search?regiao=" + r.iso).catch(() => null);
    if (id === buscaId.current) setBuscando(null);
    if (res && id === buscaId.current) setAchados({ regioes: [], cidades: res.cidades, titulo: (r.tipo === "estado" ? "Cidades em " : "Destinos em ") + r.nome });
  }

  // Busca da hospedagem: enquanto digita (auto, sem aviso de erro) ou no Enter/botão.
  async function search(auto = false, texto = hotelNome) {
    const txt = texto.trim();
    if (!dest || txt.length < 3) return;
    const id = ++hotelBusca.current;
    setSearching(true);
    if (!auto) setHits(null);
    try {
      const r = await api<{ results: Hit[] }>(`/api/geo/search?q=${encodeURIComponent(txt + " " + dest.nome)}&lat=${dest.lat}&lng=${dest.lng}${auto ? "&auto=1" : ""}`);
      if (id !== hotelBusca.current) return;
      setHits(r.results);
      if (!auto && r.results.length === 1) choose(r.results[0]);
    } catch (e) {
      if (id === hotelBusca.current && !auto) toast((e as Error).message);
    }
    if (id === hotelBusca.current) setSearching(false);
  }
  // Mostra as opções enquanto digita (espera 400 ms parado para não buscar a cada letra).
  function digitarHotel(txt: string) {
    setHotelNome(txt);
    const id = ++hotelBusca.current;
    if (txt.trim().length < 3) { setSearching(false); return setHits(null); }
    setTimeout(() => { if (id === hotelBusca.current) search(true, txt); }, 400);
  }
  function choose(h: Hit) {
    setHotel({ lat: h.lat, lng: h.lng });
    if (!hotelNome.trim() || hotelNome.trim().length < h.nome.length) setHotelNome(h.nome);
    setHits(null);
    hotelBusca.current++;
    setSearching(false);
  }

  // quantos lugares do perfil ficam a até 20 min do hotel
  const near = useMemo(() => {
    if (!hotel || !dest) return null;
    const ctx = { pois: {}, hotel: { nome: hotelNome, ...hotel }, profile, rules: DEFAULT_RULES, inicio: ini };
    return pois.filter((p) => eligible(p, ctx) && travel(hotel, p, profile).min <= 20).length;
  }, [hotel, pois, profile, dest, hotelNome, ini]);

  const nDays = daysBetween(ini, fim) + 1;

  async function generate() {
    setErr(null);
    if (!dest) return setErr("Escolha um destino da lista.");
    if (!dest.pronto) {
      preparoRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return setErr(prep?.status === "falhou" ? "Ainda não temos os lugares de " + dest.nome + " para montar o roteiro." : "Ainda estamos preparando os lugares de " + dest.nome + ". Só mais alguns segundos.");
    }
    if (!hotel) return setErr("Busque a hospedagem ou toque no mapa para marcar onde ela fica.");
    setGen(0);
    const steps = setInterval(() => setGen((k) => (k == null ? k : Math.min(k + 1, GEN.length - 1))), 380);
    try {
      const [r] = await Promise.all([
        api<{ id: number; activities: number; saved: number; days: number }>("/api/trips", {
          body: { destinationId: dest.id, inicio: ini, fim, pax, hotel: { nome: hotelNome.trim(), ...hotel } },
        }),
        new Promise((ok) => setTimeout(ok, GEN.length * 380)),
      ]);
      clearInterval(steps);
      router.push(`/app/viagem/${r.id}?novo=1&a=${r.activities}&e=${r.saved}`);
    } catch (e) {
      clearInterval(steps);
      setGen(null);
      setErr((e as Error).message);
    }
  }

  const GEN = [
    "Lendo seu perfil e as datas",
    "Buscando " + pois.length + " lugares em " + (dest?.nome ?? "seu destino"),
    "Filtrando por horário, dia e orçamento",
    "Agrupando atrações por região",
    "Calculando deslocamentos a partir do hotel",
    "Distribuindo tudo em " + nDays + (nDays === 1 ? " dia" : " dias"),
  ];

  return (
    <div className="pad">
      <div className="field">
        <label>Destino</label>
        <div className={"input-ic" + (buscando ? " on" : "")}>
          <input className="input" value={destTxt} onChange={(e) => digitar(e.target.value)} placeholder="Cidade, estado ou país" autoComplete="off" aria-busy={!!buscando} />
          {buscando ? <span className="spin spin-ok" aria-hidden /> : <Icon name="search" />}
        </div>
        {buscando && (
          <div className="box dest-busca buscando" role="status">
            <div className="busca-t"><span className="spin spin-ok" aria-hidden />Buscando “{buscando}”…</div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="near esqueleto" aria-hidden><span className="li-ic" /><span className="li-m"><b /><small /></span></div>
            ))}
          </div>
        )}
        {achados && !buscando && (
          <div className="box dest-busca">
            {achados.titulo && <div className="box-t" style={{ marginBottom: 2 }}>{achados.titulo}</div>}
            {!achados.regioes.length && !achados.cidades.length && <div className="near"><small className="muted">Nenhum destino com esse nome.</small></div>}
            {achados.regioes.map((r) => (
              <button key={r.iso} className="near" onClick={() => abrirRegiao(r)}>
                <span className="li-ic"><Icon name={r.tipo === "pais" ? "globe" : "map"} /></span>
                <span className="li-m"><b>{r.nome}</b><small>{r.tipo === "pais" ? "País" : "Estado · " + r.pais} · {r.cidades} {r.cidades === 1 ? "destino" : "destinos"}</small></span>
                <Icon name="right" />
              </button>
            ))}
            {achados.cidades.map((d) => (
              <button key={d.id} className="near" onClick={() => pickDest(d)}>
                <span className="li-ic dest-mini">
                  {d.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.fotoUrl.replace(/width=\d+/, "width=120")} alt="" loading="lazy" />
                  ) : <Icon name="pin" />}
                </span>
                <span className="li-m"><b>{d.nome}</b><small>{d.uf ? d.uf + " · " : ""}{d.pais}{d.pronto ? "" : " · novo no app"}</small></span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="sec-t dest-cards-t" style={{ marginTop: 0 }}>
        Destinos populares
        {destinations.length > 2 && <small>arraste para ver mais <Icon name="right" /></small>}
      </div>
      <div className="dest-cards" ref={carrossel}>
        {destinations.slice(0, 8).map((d) => (
          <button key={d.id} className={"dcard " + (dest?.id === d.id ? "on" : "")} onClick={() => pickDest({ ...d, pronto: true, importStatus: null })} aria-pressed={dest?.id === d.id}>
            <TripArt h={200} c1={d.cor1} c2={d.cor2} id={"dc" + d.id} foto={d.fotoUrl} />
            <span><b>{d.nome}</b><small>{d.pais}</small></span>
          </button>
        ))}
      </div>
      {dest && !dest.pronto && prep?.status !== "falhou" && (() => {
        const naFila = !!prep && prep.status === "fila" && prep.posicao > 0;
        const etapa = naFila
          ? `Na fila: ${prep!.posicao} ${prep!.posicao === 1 ? "destino" : "destinos"} na frente`
          : [...ETAPAS_PREPARO].reverse().find(([s]) => seg >= s)![1];
        // progresso estimado: anda rápido no começo e desacelera, sem nunca chegar a 100% antes de terminar
        const pct = Math.min(95, Math.round((1 - Math.exp(-seg / 30)) * 100));
        return (
          <div className="box preparo" role="status" aria-live="polite" ref={preparoRef}>
            <div className="preparo-l">
              <Gui size={52} />
              <div style={{ flex: 1 }}>
                <b>Preparando os lugares de {dest.nome}</b>
                <div className="preparo-etapa" key={etapa}><span className="spin spin-ok" aria-hidden />{etapa}…</div>
              </div>
              <span className="mono preparo-seg">{seg}s</span>
            </div>
            <div className="preparo-barra"><i style={{ width: Math.max(4, pct) + "%" }} /></div>
            <div className="muted">Carregando os lugares. Isso leva em torno de um minuto.</div>
          </div>
        );
      })()}
      {((!dest && !achados && !buscando && destTxt.trim().length > 2) || (dest && !dest.pronto && prep?.status === "falhou")) && (
        <div className="box" style={{ fontSize: 13 }}>
          <b>Ainda não conseguimos montar roteiros para “{dest ? dest.nome : destTxt.trim()}”.</b>
          <div className="muted" style={{ margin: "4px 0 10px" }}>{dest ? "Não achamos lugares suficientes nos dados abertos agora. " : ""}A equipe da agência vê os destinos mais pedidos e adiciona os próximos.</div>
          <button className="btn btn-ghost btn-sm" disabled={requested} onClick={async () => {
            await api("/api/destination-requests", { body: { termo: dest ? rotulo(dest) : destTxt } }).catch(() => {});
            setRequested(true);
            toast("Pedido registrado. Avisaremos quando esse destino entrar");
          }}>{requested ? "Pedido registrado" : "Quero esse destino"}</button>
        </div>
      )}

      <div className="two">
        <div className="field"><label>Ida</label><input className="input mono" type="date" min={today} value={ini} onChange={(e) => { setIni(e.target.value); if (e.target.value > fim) setFim(e.target.value); }} /></div>
        <div className="field"><label>Volta</label><input className="input mono" type="date" min={ini} value={fim} onChange={(e) => setFim(e.target.value)} /></div>
      </div>

      {dest && (dest.pronto || prep?.status !== "falhou") && (
        <div className="field">
          <label>Hospedagem, o Ponto Zero da viagem</label>
          <div className="row" style={{ gap: 8 }}>
            <input className="input" value={hotelNome} placeholder="Nome do hotel ou endereço" onChange={(e) => digitarHotel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} autoComplete="off" aria-busy={searching} />
            <button className="btn btn-navy" style={{ height: 48 }} onClick={() => search()} disabled={searching || hotelNome.trim().length < 3} aria-label="Buscar hospedagem" aria-busy={searching}>
              {searching ? <span className="spin spin-ok spin-claro" aria-hidden /> : <Icon name="search" />}
            </button>
          </div>
          {searching && !hits && (
            <div className="box dest-busca buscando" role="status" style={{ marginTop: 8 }}>
              <div className="busca-t"><span className="spin spin-ok" aria-hidden />Procurando “{hotelNome.trim()}” em {dest.nome}…</div>
              {[0, 1].map((i) => <div key={i} className="near esqueleto" aria-hidden><span className="li-ic" /><span className="li-m"><b /><small /></span></div>)}
            </div>
          )}
          {hits && (
            <div className="box" style={{ padding: "2px 14px", marginTop: 8 }}>
              {hits.length === 0 && <div className="near"><small className="muted">Nada encontrado. Toque no mapa para marcar o lugar.</small></div>}
              {hits.map((h, i) => (
                <button key={i} className="near" onClick={() => choose(h)}>
                  <span className="li-ic"><Icon name="bed" /></span>
                  <span className="li-m"><b>{h.nome}</b><small>{h.endereco}</small></span>
                </button>
              ))}
            </div>
          )}
          <div className="pz">
            <LeafletMap
              center={hotel ?? dest}
              zoom={hotel ? 14 : 12}
              fitKey={(hotel?.lat ?? 0) + ":" + dest.id}
              markers={hotel ? [{ key: "h", kind: "hotel", ...hotel }] : []}
              radiusKm={hotel ? 1.5 : undefined}
              onMapClick={(p) => { setHotel(p); if (!hotelNome.trim()) setHotelNome("Minha hospedagem"); }}
            />
            <div className="cap">
              <Icon name="star" />
              <span>
                {hotel && near != null ? (
                  <>Tudo parte daqui. Encontramos <b style={{ color: "var(--ink)" }}>{near} lugares</b> do seu perfil a até 20 minutos do hotel.</>
                ) : "Busque o hotel ou toque no mapa para marcar onde vai ficar."}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="field">
        <label>Viajantes</label>
        <div className="stepper">
          <b>{pax} {pax === 1 ? "pessoa" : "pessoas"}</b>
          <button onClick={() => setPax(Math.max(1, pax - 1))} aria-label="Menos">-</button>
          <button onClick={() => setPax(Math.min(20, pax + 1))} aria-label="Mais">+</button>
        </div>
      </div>
      <div className="field">
        <label>Perfil usado</label>
        <Link className="opt" style={{ margin: 0 }} href="/app/perfil-viajante?voltar=/app/nova-viagem">
          <span className="oi"><Icon name="user" /></span>
          <span style={{ flex: 1 }}>
            <b>{profile.comp}, ritmo {profile.ritmo.toLowerCase()}</b>
            <small>{profile.int.slice(0, 3).join(", ")}{profile.int.length > 3 ? " e mais " + (profile.int.length - 3) : ""}</small>
          </span>
          <Icon name="edit" />
        </Link>
      </div>
      <div className="box" style={{ background: "var(--sea-bg)", borderColor: "#BFE6DF", fontSize: 13, color: "var(--sea-ink)" }}>
        Já tem voo, ingressos ou restaurante reservados? Depois de montar, adicione na aba Reservas: o roteiro se ajusta aos horários.
      </div>
      {err && <div className="err">{err}</div>}
      <button className="btn btn-sun btn-block" style={{ marginTop: 6 }} onClick={generate} disabled={gen != null} aria-busy={!!dest && !dest.pronto && prep?.status !== "falhou"}>
        {dest && !dest.pronto && prep?.status !== "falhou"
          ? <><span className="spin spin-ok" aria-hidden />Preparando os lugares de {dest.nome}…</>
          : <><Icon name="route" />Montar meu roteiro</>}
      </button>

      {/* desenhada na moldura do app (.app), não na área que rola: cobre a tela toda mesmo com a página rolada */}
      {gen != null && createPortal(
        <div className="gen" role="status" aria-live="polite">
          <div className="gen-gui"><Gui humor={gen >= GEN.length - 1 ? "festa" : "idle"} size={72} /></div>
          <h2>Montando seu roteiro por {dest?.nome}</h2>
          {GEN.map((s, i) => (
            <div key={i} className={"st " + (i < gen ? "done" : i === gen ? "run" : "")} style={{ "--i": i } as React.CSSProperties}>
              <span className="c">{i < gen && <Icon name="check" />}</span>{s}
            </div>
          ))}
        </div>,
        document.querySelector(".app") ?? document.body,
      )}
    </div>
  );
}
