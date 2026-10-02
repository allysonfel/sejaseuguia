import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ensureSchema, getSetting, sql } from "./db";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken, verifySessionToken, type SessionKind } from "./session";
import { DEFAULT_PERMISSIONS, DEFAULT_PROFILE, type AdminModule, type Permissions, type Profile, type StaffRole } from "./types";

export type Prefs = { location: boolean; history: boolean; offers: boolean };

export type User = {
  id: number;
  kind: SessionKind;
  nome: string;
  email: string;
  staffRole: StaffRole | null;
  profile: Profile | null;
  prefs: Prefs;
  avatar: string | null;
  consentAt: string | null;
  createdAt: string;
};

type UserRow = {
  id: number; kind: SessionKind; nome: string; email: string; staff_role: StaffRole | null;
  profile: Profile | null; prefs: Prefs; avatar: string | null; consent_at: Date | null; created_at: Date;
  last_seen_at: Date | null;
};

export function mapUser(r: UserRow): User {
  return {
    id: r.id, kind: r.kind, nome: r.nome, email: r.email, staffRole: r.staff_role,
    profile: r.profile, prefs: r.prefs, avatar: r.avatar,
    consentAt: r.consent_at ? r.consent_at.toISOString() : null, createdAt: r.created_at.toISOString(),
  };
}

export async function getUserById(id: number): Promise<User | null> {
  await ensureSchema();
  const rows = await sql<UserRow[]>`SELECT * FROM users WHERE id = ${id}`;
  return rows[0] ? mapUser(rows[0]) : null;
}

/** Usuário logado (ou null). Também atualiza o "visto por último" no máximo a cada 5 min. */
export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const s = await verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!s) return null;
  await ensureSchema();
  const rows = await sql<UserRow[]>`SELECT * FROM users WHERE id = ${s.userId} AND kind = ${s.kind}`;
  const r = rows[0];
  if (!r) return null;
  if (!r.last_seen_at || Date.now() - r.last_seen_at.getTime() > 5 * 60 * 1000)
    await sql`UPDATE users SET last_seen_at = now() WHERE id = ${r.id}`;
  return mapUser(r);
}

export async function requireTraveler(): Promise<User & { profile: Profile }> {
  const u = await getCurrentUser();
  if (!u || u.kind !== "traveler") redirect("/entrar");
  return { ...u, profile: u.profile ?? DEFAULT_PROFILE };
}

export async function getPermissions(): Promise<Permissions> {
  return getSetting<Permissions>("permissions", DEFAULT_PERMISSIONS);
}

export async function allowedModules(u: User): Promise<AdminModule[]> {
  if (u.staffRole === "Administrador") return DEFAULT_PERMISSIONS.Administrador;
  const perms = await getPermissions();
  return perms[u.staffRole ?? "Financeiro"] ?? [];
}

/** Página do painel: exige alguém da equipe com acesso ao módulo. */
export async function requireStaff(mod?: AdminModule): Promise<User> {
  const u = await getCurrentUser();
  if (!u || u.kind !== "staff") redirect("/entrar?equipe=1");
  if (mod && !(await allowedModules(u)).includes(mod)) redirect("/admin");
  return u;
}

export async function startSession(userId: number, kind: SessionKind) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSessionToken({ userId, kind }), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_MAX_AGE,
  });
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
