"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/Icon";
import TripArt from "@/components/TripArt";
import { api } from "@/lib/client";
import { eligible, travel } from "@/lib/engine";
import { addDays, daysBetween } from "@/lib/format";
import { toast } from "@/lib/toast";
import { useArrastar } from "@/lib/useArrastar";
import { DEFAULT_RULES, type Destination, type DestinoBusca, type ImportStatus, type Poi, type Profile, type Regiao } from "@/lib/types";

const LeafletMap = dynamic(() => import("@/components/LeafletMap"), { ssr: false, loading: () => <div className="lmap" /> });

type Hit = { nome: string; endereco: string; lat: number; lng: number };
type Busca = { regioes: Regiao[]; cidades: DestinoBusca[]; titulo?: string };
type Preparo = { status: ImportStatus | null; lugares: number; posicao: number };

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
  const [ini, setIni] = useState(addDays(today, 14));
  const [fim, setFim] = useState(addDays(today, 17));
  const [hotelNome, setHotelNome] = useState("");
  const [hotel, setHotel] = useState<{ lat: number; lng: number } | null>(null);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [pax, setPax] = useState(2);
  const [pois, setPois] = useState<Poi[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [gen, setGen] = useState<number | null>(null);
  const [requested, setRequested] = useState(false);

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
    return () => { live = false; clearTimeout(timer); };
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
    if (txt.trim().length < 2) return setAchados(null);
    setTimeout(async () => {
      if (id !== buscaId.current) return;
      const r = await api<Busca>("/api/destinations/search?q=" + encodeURIComponent(txt.trim())).catch(() => null);
      if (r && id === buscaId.current) setAchados(r);
    }, 250);
  }

  async function abrirRegiao(r: Regiao) {
    const id = ++buscaId.current;
    const res = await api<Busca>("/api/destinations/search?regiao=" + r.iso).catch(() => null);
    if (res && id === buscaId.current) setAchados({ regioes: [], cidades: res.cidades, titulo: (r.tipo === "estado" ? "Cidades em " : "Destinos em ") + r.nome });
  }

  async function search() {
    if (!dest || hotelNome.trim().length < 3) return;
    setSearching(true);
    try {
      const r = await api<{ results: Hit[] }>(`/api/geo/search?q=${encodeURIComponent(hotelNome + " " + dest.nome)}&lat=${dest.lat}&lng=${dest.lng}`);
      setHits(r.results);
      if (r.results.length === 1) choose(r.results[0]);
    } catch (e) {
      toast((e as Error).message);
    }
    setSearching(false);
  }
  function choose(h: Hit) {
    setHotel({ lat: h.lat, lng: h.lng });
    if (!hotelNome.trim() || hotelNome.trim().length < h.nome.length) setHotelNome(h.nome);
    setHits(null);
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
    if (!dest.pronto) return setErr(prep?.status === "falhou" ? "Ainda não temos os lugares de " + dest.nome + " para montar o roteiro." : "Ainda estamos preparando os lugares de " + dest.nome + ". Só mais alguns segundos.");
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
        <input className="input" value={destTxt} onChange={(e) => digitar(e.target.value)} placeholder="Cidade, estado ou país" autoComplete="off" />
        {achados && (
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
      {dest && !dest.pronto && prep?.status !== "falhou" && (
        <div className="box preparo" role="status">
          <span className="spin" aria-hidden />
          <div>
            <b>Preparando os lugares de {dest.nome}…</b>
            <div className="muted">
              Buscamos atrações, restaurantes e horários em dados abertos. Leva em torno de um minuto
              {prep && prep.posicao > 0 ? ` (${prep.posicao} ${prep.posicao === 1 ? "destino" : "destinos"} na frente)` : ""}.
              Enquanto isso, escolha as datas e a hospedagem.
            </div>
          </div>
        </div>
      )}
      {((!dest && !achados && destTxt.trim().length > 2) || (dest && !dest.pronto && prep?.status === "falhou")) && (
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
            <input className="input" value={hotelNome} placeholder="Nome do hotel ou endereço" onChange={(e) => setHotelNome(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
            <button className="btn btn-navy" style={{ height: 48 }} onClick={search} disabled={searching || hotelNome.trim().length < 3}><Icon name="search" /></button>
          </div>
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
      <button className="btn btn-sun btn-block" style={{ marginTop: 6 }} onClick={generate} disabled={gen != null}><Icon name="route" />Montar meu roteiro</button>

      {gen != null && (
        <div className="gen">
          <div className="logo" style={{ marginBottom: 26 }}><span className="mk"><Icon name="compass" /></span><span>Seja Seu <em>Guia</em></span></div>
          <h2>Montando seu roteiro por {dest?.nome}</h2>
          {GEN.map((s, i) => (
            <div key={i} className={"st " + (i < gen ? "done" : i === gen ? "run" : "")}>
              <span className="c">{i < gen && <Icon name="check" />}</span>{s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
