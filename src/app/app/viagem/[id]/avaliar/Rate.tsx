"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { IC } from "@/lib/icons";
import { toast } from "@/lib/toast";

type Place = { id: number; nome: string; cat: string };

export default function Rate({ tripId, places, initial }: { tripId: number; places: Place[]; initial: Record<number, number> }) {
  const [stars, setStars] = useState(initial);

  async function rate(p: Place, n: number) {
    const prev = stars[p.id];
    setStars({ ...stars, [p.id]: n });
    try {
      await api(`/api/trips/${tripId}/ratings`, { body: { poiId: p.id, stars: n } });
    } catch (e) {
      setStars((s) => ({ ...s, [p.id]: prev }));
      toast((e as Error).message);
    }
  }

  // o que a pessoa mais gostou, por categoria, para explicar o efeito das notas
  const byCat: Record<string, number[]> = {};
  places.forEach((p) => stars[p.id] && (byCat[p.cat] ??= []).push(stars[p.id]));
  const liked = Object.entries(byCat).filter(([, v]) => v.reduce((a, b) => a + b, 0) / v.length >= 4).map(([c]) => c.toLowerCase());

  return (
    <>
      <div className="sec-t">Como foi cada lugar?</div>
      <div className="box" style={{ padding: "4px 16px" }}>
        {places.map((p) => (
          <div key={p.id} className="li">
            <div className="li-m"><b>{p.nome}</b><small>{p.cat}</small></div>
            <div className="stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className={n <= (stars[p.id] ?? 0) ? "on" : ""} onClick={() => rate(p, n)} aria-label={n + " estrelas"}>
                  <svg className="i" viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: IC.star }} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="box" style={{ fontSize: 13, color: "var(--muted)" }}>
        {liked.length
          ? "Você deu nota alta para " + liked.join(", ") + ", então esse tipo de lugar vai aparecer mais nas próximas viagens."
          : "Suas notas ajustam as próximas sugestões: categorias bem avaliadas ganham peso no motor de roteiros."}
      </div>
    </>
  );
}
