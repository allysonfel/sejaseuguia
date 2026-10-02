import { allowedModules, getCurrentUser, type User } from "./auth";
import type { AdminModule } from "./types";

export const ok = (data: unknown = { ok: true }) => Response.json(data);
export const fail = (error: string, status = 400) => Response.json({ error }, { status });

export async function readBody<T>(req: Request): Promise<Partial<T>> {
  try {
    return (await req.json()) as Partial<T>;
  } catch {
    return {};
  }
}

export async function apiTraveler(): Promise<User | null> {
  const u = await getCurrentUser();
  return u && u.kind === "traveler" ? u : null;
}

export async function apiStaff(mod: AdminModule): Promise<User | null> {
  const u = await getCurrentUser();
  if (!u || u.kind !== "staff") return null;
  return (await allowedModules(u)).includes(mod) ? u : null;
}

export const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
export const isTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
