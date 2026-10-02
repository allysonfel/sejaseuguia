"use client";
import { useEffect, useRef } from "react";
import type * as L from "leaflet";
import { IC, type IconName } from "@/lib/icons";

export type MapMarker = {
  key: string | number;
  lat: number;
  lng: number;
  kind: "num" | "hotel" | "me" | "pin" | "dot";
  label?: string;
  icon?: IconName;
  /** classes extras do pino ("in", "sel") */
  cls?: string;
  title?: string;
  onClick?: () => void;
};

type Props = {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  /** linha tracejada ligando os pontos (ex.: rota do dia) */
  route?: { lat: number; lng: number }[];
  /** círculo de raio em km em volta do centro */
  radiusKm?: number;
  /** muda esse valor para reenquadrar o mapa nos marcadores */
  fitKey?: string | number;
  onMapClick?: (p: { lat: number; lng: number }) => void;
  interactive?: boolean;
};

const svg = (n: IconName) => `<svg class="i" viewBox="0 0 24 24">${IC[n]}</svg>`;

function iconHtml(m: MapMarker): { html: string; size: [number, number]; anchor: [number, number] } {
  switch (m.kind) {
    case "num": return { html: `<div class="mk-num">${m.label ?? ""}</div>`, size: [26, 26], anchor: [13, 13] };
    case "hotel": return { html: `<div class="mk-hotel">${svg("star")}</div>`, size: [30, 30], anchor: [15, 15] };
    case "me": return { html: `<div class="mk-me"></div>`, size: [18, 18], anchor: [9, 9] };
    case "dot": return { html: `<div class="mk-dot"></div>`, size: [12, 12], anchor: [6, 6] };
    default: return { html: `<div class="mk-pin ${m.cls ?? ""}">${svg(m.icon ?? "pin")}</div>`, size: [30, 30], anchor: [15, 30] };
  }
}

export default function LeafletMap({ center, zoom = 13, markers = [], route, radiusKm, fitKey, onMapClick, interactive = true }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const lib = useRef<typeof L | null>(null);
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;

  // cria o mapa uma vez (o Leaflet só pode ser carregado no navegador)
  useEffect(() => {
    let dead = false;
    import("leaflet").then((mod) => {
      if (dead || !el.current || map.current) return;
      const Lf = (mod as unknown as { default?: typeof L }).default ?? (mod as unknown as typeof L);
      lib.current = Lf;
      const m = Lf.map(el.current, {
        zoomControl: interactive, attributionControl: true, dragging: interactive, scrollWheelZoom: interactive,
        doubleClickZoom: interactive, touchZoom: interactive, keyboard: interactive,
      }).setView([center.lat, center.lng], zoom);
      Lf.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      m.on("click", (e: L.LeafletMouseEvent) => clickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
      layer.current = Lf.layerGroup().addTo(m);
      map.current = m;
      draw();
      fit();
    });
    return () => {
      dead = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw() {
    const Lf = lib.current, lg = layer.current;
    if (!Lf || !lg) return;
    lg.clearLayers();
    if (radiusKm) Lf.circle([center.lat, center.lng], { radius: radiusKm * 1000, color: "#FFB21E", weight: 1.5, dashArray: "4 4", fillColor: "#FFB21E", fillOpacity: 0.1 }).addTo(lg);
    if (route && route.length > 1)
      Lf.polyline(route.map((p) => [p.lat, p.lng] as [number, number]), { color: "#0E9F8E", weight: 3.5, dashArray: "7 6", lineCap: "round" }).addTo(lg);
    for (const m of markers) {
      const ic = iconHtml(m);
      const mk = Lf.marker([m.lat, m.lng], {
        icon: Lf.divIcon({ html: ic.html, className: "", iconSize: ic.size, iconAnchor: ic.anchor }),
        title: m.title, keyboard: !!m.onClick, zIndexOffset: m.kind === "me" ? 1000 : m.cls?.includes("sel") ? 900 : 0,
      }).addTo(lg);
      if (m.onClick) mk.on("click", m.onClick);
    }
  }

  function fit() {
    const Lf = lib.current, m = map.current;
    if (!Lf || !m) return;
    const pts = markers.map((x) => [x.lat, x.lng] as [number, number]);
    if (pts.length > 1) m.fitBounds(Lf.latLngBounds(pts), { padding: [30, 30], maxZoom: 15 });
    else m.setView([center.lat, center.lng], zoom);
  }

  // redesenha quando os dados mudam
  useEffect(draw);
  useEffect(() => { fit(); }, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className="lmap" />;
}
