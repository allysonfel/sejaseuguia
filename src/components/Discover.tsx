"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/Icon";
import TabBar from "@/components/TabBar";
import TripArt from "@/components/TripArt";
import { useTripEditor } from "@/components/trip/useTripEditor";
import { api, mapsLink } from "@/lib/client";
import { addPoi, type Ctx } from "@/lib/engine";
import { priceTxt, relTime, toMin } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { TripAccess } from "@/lib/data";
import type { Poi, Profile, Rules, Trip } from "@/lib/types";

type Near = Poi & { dist: number };
type Ia = {
  poiId: number | null; confianca: "alta" | "media" | "baixa"; naoELugar: boolean; nome: string; resposta: string;
  observar?: string[]; contexto?: string; dica?: string; curiosidades: string[];
};

// Detalhes que a IA escreveu sobre a foto. "curiosidades" fica de fora quando
// o lugar já tem as curiosidades da curadoria.
function IaDetalhes({ ia, curiosidades = true, children }: { ia: Ia; curiosidades?: boolean; children?: React.ReactNode }) {
  return (
    <>
      <div className="box">
        <div className="box-t">O que vemos na sua foto</div>
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>{ia.resposta}</p>
        {children}
      </div>
      {!!ia.observar?.length && (
        <div className="box"><div className="box-t">Repare nos detalhes</div>{ia.observar.map((c, i) => <div key={i} className="fact"><Icon name="camera" /><span>{c}</span></div>)}</div>
      )}
      {ia.contexto && (
        <div className="box"><div className="box-t">Um pouco de contexto</div><p style={{ fontSize: 14, lineHeight: 1.6 }}>{ia.contexto}</p></div>
      )}
      {ia.dica && (
        <div className="box"><div className="box-t">Dica do guia</div><div className="fact"><Icon name="spark" /><span>{ia.dica}</span></div></div>
      )}
      {curiosidades && ia.curiosidades.length > 0 && (
        <div className="box"><div className="box-t">Curiosidades</div>{ia.curiosidades.map((c, i) => <div key={i} className="fact"><Icon name="star" /><span>{c}</span></div>)}</div>
      )}
    </>
  );
}
// ia: resposta da IA sobre a foto; iaView: mostrando o cartão da IA (lugar fora da nossa base).
type Photo = { url: string | null; step: number; err: string | null; near: Near[]; pick: number; notIt: boolean; ia: Ia | null; iaView: boolean } | null;

const STEPS = ["Pegando sua localização", "Procurando lugares conhecidos a menos de 1,5 km", "Ordenando do mais perto para o mais longe", "Buscando a história na nossa base"];
const STEPS_FOTO = ["Pegando sua localização", "Olhando a sua foto", "Comparando com os lugares por perto", "Buscando a história na nossa base"];

// Reduz a foto no aparelho antes de enviar (lado maior até 1024 px, JPEG):
// sobe rápido no 4G e gasta menos da cota da IA.
async function reduzir(f: File): Promise<string | null> {
  try {
    const img = await createImageBitmap(f);
    const k = Math.min(1, 1024 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    img.close();
    return c.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  }
}

function openNow(p: Poi) {
  if (p.abre === "00:00" && p.fecha === "23:59") return "Aberto o dia todo";
  const d = new Date();
  if (p.closedDays.includes(d.getDay())) return "Fechado hoje";
  const m = d.getHours() * 60 + d.getMinutes();
  return m >= toMin(p.abre) && m < toMin(p.fecha) ? "Aberto até " + p.fecha : "Abre das " + p.abre + " às " + p.fecha;
}

type Props = {
  found: (Poi & { foundAt: string })[];
  trip: (Trip & { access: TripAccess }) | null;
  pois: Record<number, Poi>;
  profile: Profile;
  rules: Rules;
  dayIdx: number;
  geo: boolean;
};

export default function Discover({ found: initialFound, trip, pois, profile, rules, dayIdx, geo }: Props) {
  const canEdit = !!trip && trip.access !== "viewer";
  const ed = useTripEditor(trip?.id ?? 0, trip?.days ?? [], trip?.version ?? 0, canEdit);
  const ctx = useMemo<Ctx | null>(() => (trip ? { pois, hotel: trip.hotel, profile, rules, inicio: trip.inicio } : null), [trip, pois, profile, rules]);
  const [found, setFound] = useState(initialFound);
  const [ph, setPh] = useState<Photo>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (ph?.url) URL.revokeObjectURL(ph.url); }, [ph?.url]);

  function start(f: File | null) {
    const url = f ? URL.createObjectURL(f) : null;
    const foto = f ? reduzir(f) : Promise.resolve(null);
    setPh({ url, step: 0, err: null, near: [], pick: 0, notIt: false, ia: null, iaView: false });
    if (!geo) return setPh((x) => x && { ...x, err: "Você desligou o uso da localização em Perfil > Privacidade e dados. Ligue de novo para descobrir o que está perto." });
    if (!navigator.geolocation) return setPh((x) => x && { ...x, err: "Este aparelho não informa a localização." });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setPh((x) => x && { ...x, step: 1 });
        try {
          const { latitude: lat, longitude: lng } = pos.coords;
          const img = await foto;
          const r = img
            ? await api<{ pois: Near[]; ia: Ia | null }>("/api/identify", { body: { lat, lng, foto: img } })
            : { ...(await api<{ pois: Near[] }>(`/api/nearby?lat=${lat}&lng=${lng}`)), ia: null };
          for (let s = 2; s <= STEPS.length; s++) {
            await new Promise((ok) => setTimeout(ok, 450));
            setPh((x) => x && { ...x, step: s });
          }
          const ia = r.ia;
          const pick = ia?.poiId ? Math.max(0, r.pois.findIndex((p) => p.id === ia.poiId)) : 0;
          // Cartão da IA quando ela reconheceu um lugar fora da nossa base (ou não há nada cadastrado por perto).
          const iaView = !!ia && !ia.poiId && !ia.naoELugar && (ia.confianca !== "baixa" || !r.pois.length);
          const err = r.pois.length || ia ? null : "Não encontramos lugares cadastrados a menos de 1,5 km de você.";
          setPh((x) => x && { ...x, near: r.pois, pick, ia, iaView, err });
          if (r.pois[pick] && !iaView) save(r.pois[pick]);
        } catch (e) {
          setPh((x) => x && { ...x, err: (e as Error).message });
        }
      },
      () => setPh((x) => x && { ...x, err: "Sem acesso à localização não dá para saber o que está perto. Libere a localização para este site e tente de novo." }),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  function save(p: Poi) {
    api("/api/discoveries", { body: { poiId: p.id } }).catch(() => {});
    setFound((l) => [{ ...p, foundAt: new Date().toISOString() }, ...l.filter((x) => x.id !== p.id)]);
  }

  const cur: Near | null = ph && !ph.iaView && ph.near.length ? ph.near[ph.pick] : null;
  const iaCard = ph?.iaView ? ph.ia : null;
  // Texto da IA junto do lugar da base só quando ela apontou exatamente esse lugar.
  const iaSobreCur = cur && ph?.ia?.poiId === cur.id ? ph.ia : null;
  const dn = cur ? ed.days.findIndex((d) => d.items.some((i) => i.p === cur.id)) : -1;
  const sameDest = !!(cur && trip && cur.destinationId === trip.destinationId && pois[cur.id]);

  function addToTrip() {
    if (!cur || !ctx || !trip) return;
    const r = addPoi(ed.days, dayIdx, cur.id, ctx);
    ed.commit(r.days, "add", "Adicionou " + cur.nome + " pelo O que é?");
    toast(cur.nome + " entrou no Dia " + (dayIdx + 1));
  }

  const today = trip ? ed.days[dayIdx]?.items.map((i) => pois[i.p]).filter((p) => p && !found.some((f) => f.id === p.id)).slice(0, 4) ?? [] : [];

  return (
    <>
      <div className="a-body">
        <div className="pad">
          <div className="disc-hero">
            <TripArt h={210} c1={trip?.cor1} c2={trip?.cor2} id="dsky" />
            <div className="cap"><b>Fotografe e descubra</b>Monumentos, museus, igrejas, praças e mirantes</div>
          </div>
          <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { start(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          <button className="btn btn-sun btn-block" style={{ height: 54, fontSize: 16 }} onClick={() => file.current?.click()}><Icon name="camera" />Tirar foto</button>
          <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => start(null)}><Icon name="pin" />Só ver o que está perto de mim</button>
          <div className="how">
            <div><b>1</b>Aponte a câmera para o lugar</div>
            <div><b>2</b>Usamos sua localização para achar o que está perto</div>
            <div><b>3</b>Veja a história, curiosidades e horários</div>
          </div>
          <p className="muted" style={{ fontSize: 12, margin: "-4px 2px 4px", lineHeight: 1.5 }}>
            A foto é analisada por uma IA externa e não fica guardada. Evite fotografar pessoas. <Link className="link" href="/app/privacidade">Saiba mais</Link>
          </p>

          <div className="sec-t">Minhas descobertas</div>
          {found.length ? (
            <div className="box" style={{ padding: "4px 16px" }}>
              {found.map((p) => (
                <button key={p.id} className="li" style={{ width: "100%", textAlign: "left" }} onClick={() => setPh({ url: null, step: STEPS.length, err: null, near: [{ ...p, dist: -1 }], pick: 0, notIt: false, ia: null, iaView: false })}>
                  <span className="li-ic"><Icon name="star" /></span>
                  <div className="li-m"><b>{p.nome}</b><small>{p.cat} · {p.bairro} · {relTime(p.foundAt)}</small></div>
                  <Icon name="right" />
                </button>
              ))}
            </div>
          ) : (
            <div className="box"><div className="empty" style={{ padding: "14px 6px" }}><div className="ei"><Icon name="camera" /></div><b>Nenhuma descoberta ainda</b>Os lugares que você fotografar ficam guardados aqui, com a história.</div></div>
          )}
          {today.length > 0 && (
            <>
              <div className="sec-t">Para fotografar hoje</div>
              <div className="chips">{today.map((p) => <span key={p.id} className="chip"><Icon name="pin" />{p.nome}</span>)}</div>
            </>
          )}
        </div>
      </div>
      <TabBar />

      {ph && (
        <div className="pv">
          <div className="shot">
            {ph.url ? <img className="photo-prev" src={ph.url} alt="Sua foto" /> : <TripArt h={700} c1={trip?.cor1} c2={trip?.cor2} id="psky" />}
            <div className="pbar">
              <button className="icon-btn" onClick={() => setPh(null)} aria-label="Fechar"><Icon name="close" /></button>
              <b>{cur || iaCard ? "Lugar encontrado" : "O que é isso?"}</b>
              <span style={{ width: 42 }} />
            </div>
            {!cur && !iaCard && !ph.err && (
              <>
                <div className="frame"><i /><i /><i /><i /></div>
                <div className="scan" />
                <div className="steps">
                  {(ph.url ? STEPS_FOTO : STEPS).map((s, i) => (
                    <div key={i} className={"st " + (i < ph.step ? "done" : i === ph.step ? "run" : "")}>
                      <span className="c">{i < ph.step && <Icon name="check" />}</span>{s}
                    </div>
                  ))}
                </div>
              </>
            )}
            {ph.err && (
              <div className="pres" style={{ top: "45%" }}>
                <div className="grab" />
                <h2 style={{ fontSize: 22 }}>Não deu desta vez</h2>
                <p className="muted" style={{ margin: "6px 0 16px" }}>{ph.err}</p>
                <button className="btn btn-sun btn-block" onClick={() => setPh(null)}>Ok</button>
              </div>
            )}
            {cur && (
              <div className="pres">
                <div className="grab" />
                <div className="row" style={{ gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  {cur.dist >= 0 ? (
                    <span className="badge b-sea"><Icon name="pin" />{ph.pick === 0 ? "O mais perto de você" : "Escolhido por você"} · a {cur.dist} m</span>
                  ) : (
                    <span className="badge b-sea"><Icon name="check" />Salvo em Minhas descobertas</span>
                  )}
                  {iaSobreCur && <span className="badge b-sea"><Icon name="camera" />Reconhecido pela foto</span>}
                  {cur.revisado === false && <span className="badge b-violet" title="Sugerido automaticamente a partir de dados abertos. A agência ainda não revisou este lugar.">Sugestão automática</span>}
                </div>
                <h2>{cur.nome}</h2>
                <div className="muted" style={{ fontSize: 13, margin: "2px 0 12px" }}>{cur.cat} · {cur.bairro}</div>
                {ph.notIt && ph.near.length > 1 && (
                  <div className="box">
                    <div className="box-t">Qual destes é o lugar?</div>
                    {ph.near.filter((_, i) => i !== ph.pick).map((x) => (
                      <button key={x.id} className="li" style={{ width: "100%", textAlign: "left" }} onClick={() => { const i = ph.near.indexOf(x); setPh({ ...ph, pick: i, notIt: false }); save(x); }}>
                        <span className="li-ic"><Icon name="pin" /></span>
                        <div className="li-m"><b>{x.nome}</b><small>{x.cat} · a {x.dist} m</small></div>
                      </button>
                    ))}
                  </div>
                )}
                {iaSobreCur && <IaDetalhes ia={iaSobreCur} curiosidades={!cur.curiosidades.length} />}
                {ph.ia?.naoELugar && !iaSobreCur && (
                  <IaDetalhes ia={ph.ia}>
                    <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>Não parece um lugar, então mostramos o que está mais perto de você.</p>
                  </IaDetalhes>
                )}
                {cur.historia ? (
                  <div className="box"><div className="box-t">A história em 30 segundos</div><p style={{ fontSize: 14, lineHeight: 1.6 }}>{cur.historia}</p></div>
                ) : (
                  <div className="box muted" style={{ fontSize: 13 }}>A curadoria ainda não escreveu a história deste lugar.</div>
                )}
                {cur.curiosidades.length > 0 && (
                  <div className="box"><div className="box-t">Curiosidades</div>{cur.curiosidades.map((c, i) => <div key={i} className="fact"><Icon name="star" /><span>{c}</span></div>)}</div>
                )}
                {cur.datas.length > 0 && (
                  <div className="box"><div className="box-t">Datas</div><div className="dates">{cur.datas.map((x, i) => <span key={i}><b>{x.ano}</b>{x.txt}</span>)}</div></div>
                )}
                <div className="box" style={{ fontSize: 13 }}>
                  <div className="between"><span className="muted">Agora</span><span className="badge b-sea">{openNow(cur)}</span></div>
                  <div style={{ marginTop: 6 }}>Preço {priceTxt(cur.preco, trip?.moeda ?? "€")}{cur.tip ? " · " + cur.tip : ""}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {sameDest && dn >= 0 ? (
                    <Link className="btn btn-navy" href={`/app/viagem/${trip!.id}?dia=${dn}`}><Icon name="route" />Está no Dia {dn + 1}</Link>
                  ) : sameDest && canEdit ? (
                    <button className="btn btn-navy" onClick={addToTrip}><Icon name="plus" />Adicionar ao roteiro</button>
                  ) : <span />}
                  <a className="btn btn-ghost" href={mapsLink(cur)} target="_blank" rel="noreferrer"><Icon name="nav" />Como chegar</a>
                </div>
                {(ph.near.length > 1 || (ph.ia && !ph.ia.naoELugar && !iaSobreCur)) && (
                  <div className="between" style={{ marginTop: 12, fontSize: 12.5 }}>
                    <span className="muted">{iaSobreCur ? "Identificado pela foto e pela localização" : "Identificado pela sua localização"}</span>
                    {ph.ia && !ph.ia.naoELugar && !iaSobreCur ? (
                      <button className="link" onClick={() => setPh({ ...ph, iaView: true })}>Ver o que a IA viu</button>
                    ) : (
                      <button className="link" onClick={() => setPh({ ...ph, notIt: true })}>Não é isso</button>
                    )}
                  </div>
                )}
              </div>
            )}
            {iaCard && (
              <div className="pres">
                <div className="grab" />
                <div className="row" style={{ gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <span className="badge b-sea"><Icon name="camera" />Reconhecido pela foto</span>
                </div>
                <h2>{iaCard.nome || "Não reconhecemos com certeza"}</h2>
                <IaDetalhes ia={iaCard} />
                <p className="muted" style={{ fontSize: 12, margin: "4px 0 12px" }}>Texto gerado por IA a partir da foto: pode ter erros. Este lugar ainda não está na nossa base com horários e preços.</p>
                {ph.near.length > 0 && (
                  <button className="btn btn-ghost btn-block" onClick={() => setPh({ ...ph, iaView: false, pick: 0 })}><Icon name="pin" />Ver lugares cadastrados por perto</button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
