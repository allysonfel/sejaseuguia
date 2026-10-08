import type { Poi } from "./types";

/** Lugar sem revisão há mais que isso sai das sugestões até alguém revisar.
 *  Não vale para os importados automaticamente (revisado = false): esses são atualizados por reimportação. */
export const STALE_DAYS = 60;

export const daysSinceReview = (p: Pick<Poi, "reviewedAt">) => Math.floor((Date.now() - new Date(p.reviewedAt).getTime()) / 86400000);
export const isStale = (p: Pick<Poi, "reviewedAt" | "revisado">) => p.revisado !== false && daysSinceReview(p) > STALE_DAYS;
