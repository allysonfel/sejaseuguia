"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import Icon from "@/components/Icon";
import type { Recurso } from "@/lib/planosPadrao";
import { Bloqueado, PlanosSheet } from "./Planos";

// Tela inteira no lugar de uma função que a viagem não tem (por exemplo, o Modo viagem).
export default function FuncaoBloqueada({ tripId, destino, recurso, acesso }: { tripId: number; destino: string; recurso: Recurso; acesso: { comprados: Recurso[]; abre: number } }) {
  const [aberto, setAberto] = useState(false);
  const fechar = useCallback(() => setAberto(false), []);
  return (
    <>
      <div className="a-head">
        <Link className="icon-btn" href={`/app/viagem/${tripId}`} aria-label="Voltar ao roteiro"><Icon name="back" /></Link>
        <div className="t" style={{ flex: 1 }}><small>{destino}</small><b>Modo viagem</b></div>
      </div>
      <div className="a-body">
        <Bloqueado recurso={recurso} acesso={acesso} onPlanos={() => setAberto(true)} />
        <p className="muted" style={{ fontSize: 13, textAlign: "center", padding: "0 28px" }}>O roteiro dia a dia continua aberto no <Link className="link" href={`/app/viagem/${tripId}`}>Roteiro</Link>.</p>
      </div>
      {aberto && <PlanosSheet tripId={tripId} motivo={recurso} onClose={fechar} />}
    </>
  );
}
