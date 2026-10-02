"use client";
import dynamic from "next/dynamic";
import type { Hotel } from "@/lib/types";

const LeafletMap = dynamic(() => import("@/components/LeafletMap"), { ssr: false, loading: () => <div className="lmap" /> });

export default function PublicMap({ hotel, pts }: { hotel: Hotel; pts: { id: number; lat: number; lng: number; nome: string }[] }) {
  return (
    <LeafletMap
      center={hotel}
      fitKey={pts.map((p) => p.id).join(",")}
      route={[hotel, ...pts, hotel]}
      markers={[
        { key: "h", kind: "hotel", lat: hotel.lat, lng: hotel.lng, title: hotel.nome },
        ...pts.map((p, i) => ({ key: p.id, kind: "num" as const, label: String(i + 1), lat: p.lat, lng: p.lng, title: p.nome })),
      ]}
    />
  );
}
