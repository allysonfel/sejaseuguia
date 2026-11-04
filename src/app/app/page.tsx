import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import Icon from "@/components/Icon";
import TabBar from "@/components/TabBar";
import TripArt from "@/components/TripArt";
import { requireTraveler } from "@/lib/auth";
import { listReservations, listTripsForUser, tripStatus } from "@/lib/data";
import { dayLabel, daysBetween, firstName, longToday, rangeTxt, todayIso } from "@/lib/format";
import { getNotifications, resIcon } from "@/lib/notifications";
import { persona } from "@/lib/quiz";

const STATUS_BADGE = { Planejada: "b-sun", "Em andamento": "b-sea", Encerrada: "b-grey" } as const;

const GRUPOS = [
  { id: "atuais", nome: "Atuais", vazio: "Nenhuma viagem acontecendo agora." },
  { id: "futuros", nome: "Futuros", vazio: "Nenhuma viagem planejada. Que tal começar uma?" },
  { id: "realizados", nome: "Realizados", vazio: "As viagens que você terminar aparecem aqui." },
] as const;
type Grupo = (typeof GRUPOS)[number]["id"];

export default async function Inicio({ searchParams }: { searchParams: Promise<{ roteiros?: string }> }) {
  const u = await requireTraveler();
  const sp = await searchParams;
  const today = todayIso();
  const trips = await listTripsForUser(u);
  const res = await listReservations(trips.map((t) => t.id));
  const notifs = await getNotifications(u, trips, res);
  const upcoming = res.filter((r) => r.data && r.data >= today).slice(0, 4);
  const p = u.profile;
  const style = persona(p);

  // Meus roteiros: atuais (em andamento), futuros (mais próximo primeiro) e realizados (mais recente primeiro)
  const grupos: Record<Grupo, typeof trips> = {
    atuais: trips.filter((t) => tripStatus(t, today) === "Em andamento"),
    futuros: trips.filter((t) => tripStatus(t, today) === "Planejada"),
    realizados: trips.filter((t) => tripStatus(t, today) === "Encerrada").sort((a, b) => b.fim.localeCompare(a.fim)),
  };
  const pedido = GRUPOS.find((g) => g.id === sp.roteiros)?.id;
  const aba: Grupo = pedido ?? (grupos.atuais.length ? "atuais" : grupos.futuros.length ? "futuros" : "realizados");
  const lista = grupos[aba];
  const destaque = aba === "realizados" ? null : lista[0] ?? null;
  const resto = destaque ? lista.slice(1) : lista;

  let count = "";
  if (destaque) {
    const n = daysBetween(today, destaque.inicio);
    count = aba === "atuais" ? "Acontecendo agora" : n === 1 ? "Falta 1 dia" : "Faltam " + n + " dias";
  }

  return (
    <>
      <AppHeader title={"Olá, " + firstName(u.nome)} sub={longToday(today)} avatar={u.avatar} notifs={notifs} />
      <div className="a-body">
        <div className="pad">
          {trips.length === 0 ? (
            <div className="box" style={{ background: "var(--navy)", color: "#fff", borderColor: "var(--navy)" }}>
              <b className="serif" style={{ fontSize: 22, display: "block" }}>Sua primeira viagem começa aqui</b>
              <p style={{ color: "#B7C0DA", fontSize: 13, margin: "6px 0 12px" }}>Escolha o destino, as datas e o hotel. O roteiro dia a dia a gente monta.</p>
              <Link className="btn btn-sun" href="/app/nova-viagem"><Icon name="plus" />Planejar viagem</Link>
            </div>
          ) : (
            <>
              <Link className="plan-cta" href="/app/nova-viagem">
                <span className="pc-ic"><Icon name="plus" /></span>
                <span style={{ flex: 1 }}><b>Planejar nova viagem</b><small>Destino, datas e hotel. O resto a gente monta.</small></span>
                <Icon name="right" />
              </Link>

              <div className="sec-t">Meus roteiros</div>
              <div className="seg trips" role="tablist">
                {GRUPOS.map((g) => (
                  <Link key={g.id} href={"/app?roteiros=" + g.id} scroll={false} replace role="tab" aria-selected={aba === g.id} className={aba === g.id ? "on" : ""}>
                    {g.nome}{grupos[g.id].length ? " (" + grupos[g.id].length + ")" : ""}
                  </Link>
                ))}
              </div>

              {destaque && (
                <Link className="trip-hero" href={"/app/viagem/" + destaque.id}>
                  <div className="art">
                    <TripArt h={150} c1={destaque.cor1} c2={destaque.cor2} foto={destaque.fotoUrl} />
                    <span className="count">{count}</span>
                  </div>
                  <div className="inf">
                    <h3>{destaque.destino}</h3>
                    <div className="meta">
                      <span>{rangeTxt(destaque.inicio, destaque.fim)}</span>
                      <span>{destaque.pax} {destaque.pax === 1 ? "viajante" : "viajantes"}</span>
                      <span>{destaque.days.reduce((a, d) => a + d.items.length, 0)} atividades em {destaque.days.length} dias</span>
                    </div>
                    <div className="row" style={{ marginTop: 12, gap: 8 }}>
                      <span className={"badge " + STATUS_BADGE[tripStatus(destaque, today)]}>{tripStatus(destaque, today)}</span>
                      <span className="badge" style={{ background: "rgba(255,255,255,.1)", color: "#fff" }}>{destaque.hotel.nome}</span>
                    </div>
                  </div>
                </Link>
              )}
              {resto.map((t) => {
                const st = tripStatus(t, today);
                return (
                  <Link key={t.id} className="mini-trip" href={st === "Encerrada" ? "/app/viagem/" + t.id + "/avaliar" : "/app/viagem/" + t.id}>
                    <span className="th"><TripArt h={150} c1={t.cor1} c2={t.cor2} id={"sky" + t.id} foto={t.fotoUrl} /></span>
                    <span style={{ flex: 1 }}>
                      <b>{t.destino}</b><br />
                      <small className="muted">{st === "Encerrada" ? rangeTxt(t.inicio, t.fim) + " · avalie os lugares que visitou" : rangeTxt(t.inicio, t.fim)}{t.access !== "owner" ? " · convidado" : ""}</small>
                    </span>
                    <span className={"badge " + STATUS_BADGE[st]}>{st}</span>
                  </Link>
                );
              })}
              {lista.length === 0 && (
                <div className="box" style={{ marginBottom: 10 }}><small className="muted">{GRUPOS.find((g) => g.id === aba)!.vazio}</small></div>
              )}
            </>
          )}

          <Link className="disc-card" href="/app/descobrir">
            <span className="dc-ic"><Icon name="camera" /></span>
            <span style={{ flex: 1 }}><b>O que é esse lugar?</b><small>Fotografe um monumento e veja a história do que está perto de você</small></span>
            <Icon name="right" />
          </Link>
          <Link className="new-trip" href="/app/explorar">
            <span className="p" style={{ background: "var(--sea-bg)", color: "var(--sea-ink)" }}><Icon name="map" /></span>
            <span><b style={{ display: "block" }}>Explorar lugares por perto</b><small className="muted" style={{ fontWeight: 500 }}>Mapa com o que tem ao redor e o que já está no roteiro</small></span>
          </Link>

          <div className="sec-t">Próximos compromissos</div>
          <div className="box" style={{ padding: "4px 16px" }}>
            {upcoming.length === 0 && <div className="li"><div className="li-m"><small>Nada marcado ainda. Adicione voo, hotel e ingressos na aba Reservas da viagem.</small></div></div>}
            {upcoming.map((r) => (
              <Link key={r.id} className="li" href={"/app/viagem/" + r.tripId + "?aba=reservas"}>
                <span className="li-ic"><Icon name={resIcon(r.tipo)} /></span>
                <div className="li-m"><b>{r.nome}</b><small>{dayLabel(r.data!)}{r.hora ? " · " + r.hora : ""}{r.codigo ? " · " + r.codigo : ""}</small></div>
              </Link>
            ))}
          </div>

          <div className="box" style={{ marginTop: 6, background: "var(--navy)", color: "#fff", borderColor: "var(--navy)" }}>
            <div className="between">
              <div>
                <small style={{ color: "#B7C0DA", fontSize: 12 }}>Seu estilo de viajante</small>
                <b className="serif" style={{ display: "block", fontSize: 19, color: "var(--sun)" }}>{style.nome}</b>
                <div style={{ color: "#B7C0DA", fontSize: 12.5, marginTop: 2 }}>{p.comp} · {p.ritmo} · {p.orc}</div>
              </div>
              <Link className="btn btn-sun btn-sm" href="/app/perfil-viajante">Ajustar</Link>
            </div>
          </div>
        </div>
      </div>
      <TabBar />
    </>
  );
}
