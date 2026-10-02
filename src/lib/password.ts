import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Formato guardado: "scrypt$<sal hex>$<hash hex>".
export function hashPassword(pass: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pass, salt, 64);
  return "scrypt$" + salt.toString("hex") + "$" + hash.toString("hex");
}

export function verifyPassword(pass: string, stored: string): boolean {
  const [alg, saltHex, hashHex] = stored.split("$");
  if (alg !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const got = scryptSync(pass, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(got, expected);
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}
