import { randomBytes } from "node:crypto";
import type { User } from "./auth";
import { getRules, poisForTrip, ratingsByCategory } from "./data";
import type { Ctx, Forced } from "./engine";
import { daysBetween, hm, toMin } from "./format";
import { DEFAULT_PROFILE, type Reservation, type Trip } from "./types";

export async function tripCtx(trip: Trip, u: User): Promise<Ctx> {
  return { pois: await poisForTrip(trip), hotel: trip.hotel, profile: u.profile ?? DEFAULT_PROFILE, rules: await getRules(), inicio: trip.inicio };
}

export async function userRatings(u: User) {
  return u.prefs.history ? ratingsByCategory(u.id) : {};
}

/** Reservas ligadas a um lugar e com data dentro da viagem viram paradas travadas. */
export function forcedFromReservations(trip: { inicio: string; fim: string }, res: Reservation[]): Forced[] {
  return res
    .filter((r) => r.poiId && r.data && r.data >= trip.inicio && r.data <= trip.fim)
    .map((r) => ({ poiId: r.poiId!, dayIdx: daysBetween(trip.inicio, r.data!), time: r.hora }));
}

/** Voo no último dia: o roteiro termina 3 h antes, para dar tempo de ir ao aeroporto. */
export function lastDayEnd(trip: { fim: string }, res: Reservation[]): string | null {
  const v = res.find((r) => r.tipo === "Voo" && r.data === trip.fim && r.hora);
  if (!v) return null;
  return hm(Math.max(toMin(v.hora!) - 180, 11 * 60));
}

export function newSlug(destino: string): string {
  const base = destino.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
  return (base || "viagem") + "-" + randomBytes(3).toString("hex");
}
