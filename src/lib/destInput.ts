import { str } from "./api";

const FREQS = ["Semanal", "Quinzenal", "Mensal"];

export function parseDest(b: Record<string, unknown>) {
  const nome = str(b.nome, 60), pais = str(b.pais, 60);
  if (!nome || !pais) return "Informe cidade e país.";
  const lat = Number(b.lat), lng = Number(b.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "Marque o centro do destino no mapa.";
  const hex = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : d);
  // Foto: só endereço https (a equipe pode colar outra no lugar da automática).
  const fotoUrl = str(b.fotoUrl, 600);
  if (fotoUrl && !/^https:\/\/[^\s"'<>]+$/.test(fotoUrl)) return "A foto precisa ser um endereço https.";
  return {
    nome, pais, lat, lng, moeda: str(b.moeda, 4) || "€", updateFreq: FREQS.includes(String(b.updateFreq)) ? String(b.updateFreq) : "Mensal",
    cor1: hex(b.cor1, "#FFB21E"), cor2: hex(b.cor2, "#101B3B"),
    fotoUrl: fotoUrl || null, fotoCredito: fotoUrl ? str(b.fotoCredito, 200) || null : null,
  };
}
