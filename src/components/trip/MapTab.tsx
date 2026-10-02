"use client";
import dynamic from "next/dynamic";
import Icon from "@/components/Icon";
import { mapsLink } from "@/lib/client";
import type { SDay } from "@/lib/engine";
import { hm } from "@/lib/format";
import type { Hotel } from "@/lib/types";

const LeafletMap = dynamic(() => import("@/components/LeafletMap"), { ssr: false, loading: () => <div className="lmap" /> });

export default function MapTab({ d, hotel }: { d: SDay; hotel: Hotel }) {
  const pts = d.items.map((it) => it.poi);
  return (
    <>
      <div className="map-box">
        <LeafletMap
          center={hotel}
          fitKey={d.idx + ":" + pts.map((p) => p.id).join(",")}
          route={[hotel, ...pts, hotel]}
          markers={[
            { key: "h", kind: "hotel", lat: hotel.lat, lng: hotel.lng, title: hotel.nome },
            ...pts.map((p, i) => ({ key: p.id, kind: "num" as const, label: String(i + 1), lat: p.lat, lng: p.lng, title: p.nome })),
          ]}
        />
        <div className="map-list">
          {d.items.map((it, i) => (
            <div key={i} className="li">
              <span className="li-ic mono" style={{ background: "var(--navy)", color: "var(--sun)", fontWeight: 800 }}>{i + 1}</span>
              <div className="li-m"><b>{it.poi.nome}</b><small>{hm(it.ini)} · {it.tr.min} min {it.tr.modo} desde o ponto anterior</small></div>
              <a className="btn btn-ghost btn-sm" href={mapsLink(it.poi, i ? d.items[i - 1].poi : hotel, it.tr.modo)} target="_blank" rel="noreferrer" title="Abrir rota no app de mapas">
                <Icon name="nav" />
              </a>
            </div>
          ))}
          {d.items.length === 0 && <div className="li"><div className="li-m"><small>Nenhuma atividade nesse dia.</small></div></div>}
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12, padding: "8px 18px 0" }}>A navegação abre no app de mapas do celular, com a rota a partir da parada anterior.</p>
    </>
  );
}
