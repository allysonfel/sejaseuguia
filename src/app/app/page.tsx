import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import Icon from "@/components/Icon";
import TabBar from "@/components/TabBar";
import TripArt from "@/components/TripArt";
import { requireTraveler } from "@/lib/auth";
import { listReservations, listTripsForUser, pickActiveTrip, tripStatus } from "@/lib/data";
import { dayLabel, daysBetween, firstName, longToday, rangeTxt, todayIso } from "@/lib/format";
import { getNotifications, resIcon } from "@/lib/notifications";
import { persona } from "@/lib/quiz";

const STATUS_BADGE = { Planejada: "b-sun", "Em andamento": "b-sea", Encerrada: "b-grey" } as const;

export default async function Inicio() {
  const u = await requireTraveler();
  const today = todayIso();
  const trips = await listTripsForUser(u);
  const res = await listReservations(trips.map((t) => t.id));
  const notifs = await getNotifications(u, trips, res);
  const active = pickActiveTrip(trips, today);
  const others = trips.filter((t) => t !== active);
  const upcoming = res.filter((r) => r.data && r.data >= today).slice(0, 4);
  const p = u.profile;
  const style = persona(p);

  let count = "";
  if (active) {
    const st = tripStatus(active, today);
    const n = daysBetween(today, active.inicio);
    count = st === "Em andamento" ? "Acontecendo agora" : st === "Encerrada" ? "Viagem encerrada" : n === 1 ? "Falta 1 dia" : "Faltam " + n + " dias";
  }

  return (
    <>
      <AppHeader title={"Olá, " + firstName(u.nome)} sub={longToday(today)} avatar={u.avatar} notifs={notifs} />
      <div className="a-body">
        <div className="pad">
          {active ? (
            <Link className="trip-hero" href={"/app/viagem/" + active.id}>
              <div className="art">
                <TripArt h={150} c1={active.cor1} c2={active.cor2} foto={active.fotoUrl} />
                <span className="count">{count}</span>
              </div>
              <div className="inf">
                <h3>{active.destino}</h3>
                <div className="meta">
                  <span>{rangeTxt(active.inicio, active.fim)}</span>
                  <span>{active.pax} {active.pax === 1 ? "viajante" : "viajantes"}</span>
                  <span>{active.days.reduce((a, d) => a + d.items.length, 0)} atividades em {active.days.length} dias</span>
                </div>
                <div className="row" style={{ marginTop: 12, gap: 8 }}>
                  <span className={"badge " + STATUS_BADGE[tripStatus(active, today)]}>{tripStatus(active, today)}</span>
                  <span className="badge" style={{ background: "rgba(255,255,255,.1)", color: "#fff" }}>{active.hotel.nome}</span>
                </div>
              </div>
            </Link>
          ) : (
            <div className="box" style={{ background: "var(--navy)", color: "#fff", borderColor: "var(--navy)" }}>
              <b className="serif" style={{ fontSize: 22, display: "block" }}>Sua primeira viagem começa aqui</b>
              <p style={{ color: "#B7C0DA", fontSize: 13, margin: "6px 0 12px" }}>Escolha o destino, as datas e o hotel. O roteiro dia a dia a gente monta.</p>
              <Link className="btn btn-sun" href="/app/nova-viagem"><Icon name="plus" />Planejar viagem</Link>
            </div>
          )}

          <Link className="new-trip" href="/app/nova-viagem">
            <span className="p"><Icon name="plus" /></span>
            <span><b style={{ display: "block" }}>Planejar nova viagem</b><small className="muted" style={{ fontWeight: 500 }}>Destino, datas e hotel. O resto a gente monta.</small></span>
          </Link>
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

          {others.length > 0 && <div className="sec-t">Outras viagens</div>}
          {others.map((t) => {
            const st = tripStatus(t, today);
            return (
              <Link key={t.id} className="mini-trip" href={st === "Encerrada" ? "/app/viagem/" + t.id + "/avaliar" : "/app/viagem/" + t.id}>
                <span className="th"><TripArt h={150} c1={t.cor1} c2={t.cor2} id={"sky" + t.id} foto={t.fotoUrl} /></span>
                <span style={{ flex: 1 }}>
                  <b>{t.destino}</b><br />
                  <small className="muted">{st === "Encerrada" ? "Encerrada · avalie os lugares que visitou" : rangeTxt(t.inicio, t.fim)}{t.access !== "owner" ? " · convidado" : ""}</small>
                </span>
                <span className={"badge " + STATUS_BADGE[st]}>{st}</span>
              </Link>
            );
          })}

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
