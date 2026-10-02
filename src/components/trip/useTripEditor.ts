"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "@/lib/client";
import { toast } from "@/lib/toast";
import type { DayPlan, ReplanKind } from "@/lib/types";

// Estado do roteiro no cliente: muda na hora (o motor roda aqui) e salva em
// seguida, em fila, com a versão do servidor para não atropelar outra pessoa.
export function useTripEditor(tripId: number, initialDays: DayPlan[], initialVersion: number, canEdit: boolean) {
  const router = useRouter();
  const [days, setDaysState] = useState(initialDays);
  const [undo, setUndo] = useState<DayPlan[] | null>(null);
  const version = useRef(initialVersion);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const current = useRef(initialDays);

  const setDays = (d: DayPlan[]) => {
    current.current = d;
    setDaysState(d);
  };

  function commit(next: DayPlan[], kind: ReplanKind | null, activity?: string) {
    if (!canEdit) {
      toast("Você pode ver este roteiro, mas não editar");
      return;
    }
    const prev = current.current;
    setUndo(kind === "undo" ? null : prev);
    setDays(next);
    queue.current = queue.current.then(async () => {
      try {
        const r = await api<{ version: number }>(`/api/trips/${tripId}/days`, { method: "PUT", body: { days: next, version: version.current, kind, activity } });
        version.current = r.version;
      } catch (e) {
        toast((e as Error).message);
        if ((e as { status?: number }).status === 409) router.refresh();
        else setDays(prev);
      }
    });
  }

  function revert() {
    if (undo) commit(undo, "undo", "Desfez a última mudança");
  }

  /** Quando o servidor já devolveu o roteiro novo (ex.: depois de salvar uma reserva). */
  function adopt(next: DayPlan[], v: number) {
    version.current = v;
    setDays(next);
    setUndo(null);
  }

  return { days, commit, undo, revert, adopt, clearUndo: () => setUndo(null) };
}
