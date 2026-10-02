// Sessão: cookie assinado (HMAC) "<id>|<tipo>|<expiraEm>.<assinatura>".
// Usa só Web Crypto pra funcionar também no proxy (Edge Runtime).

export const SESSION_COOKIE = "ssg_session";
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 dias, em segundos

export type SessionKind = "traveler" | "staff";
export type Session = { userId: number; kind: SessionKind };

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sign(value: string): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET não configurado");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(s: Session): Promise<string> {
  const payload = `${s.userId}|${s.kind}|${Date.now() + SESSION_MAX_AGE * 1000}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    if (!safeEqual(sig, await sign(payload))) return null;
  } catch {
    return null;
  }
  const [id, kind, exp] = payload.split("|");
  if (!Number(id) || (kind !== "traveler" && kind !== "staff") || Date.now() >= Number(exp)) return null;
  return { userId: Number(id), kind };
}
