import "server-only";
import { sql } from "./db";

// Clima típico do mês da viagem: média das máximas e mínimas e dias com chuva
// (1 mm ou mais) nos últimos 3 anos, pelo histórico da Open-Meteo (a mesma que
// o Modo viagem já usa para o tempo de agora). Uma busca por destino e mês,
// guardada em clima_mes por 1 ano. Falhou ou demorou: a tela segue sem o clima.
export type ClimaMes = { mes: number; tmin: number; tmax: number; diasChuva: number };

const ANOS = 3;

async function buscar(lat: number, lng: number, mes: number): Promise<Omit<ClimaMes, "mes"> | null> {
  const ano = new Date().getUTCFullYear();
  const dias: { max: number; min: number; chuva: number }[] = [];
  // O mês dos últimos 3 anos já fechados (se o mês ainda não acabou neste ano, começa no anterior).
  const atual = new Date().getUTCMonth() + 1;
  const ultimo = mes < atual ? ano : ano - 1;
  const fim = new Date(Date.UTC(ultimo, mes, 0)).toISOString().slice(0, 10);
  const ini = new Date(Date.UTC(ultimo - ANOS + 1, mes - 1, 1)).toISOString().slice(0, 10);
  const p = new URLSearchParams({
    latitude: lat.toFixed(3), longitude: lng.toFixed(3), start_date: ini, end_date: fim,
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum", timezone: "auto",
  });
  const res = await fetch("https://archive-api.open-meteo.com/v1/archive?" + p, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) return null;
  const j = (await res.json()) as { daily?: { time: string[]; temperature_2m_max: (number | null)[]; temperature_2m_min: (number | null)[]; precipitation_sum: (number | null)[] } };
  const d = j.daily;
  if (!d) return null;
  d.time.forEach((t, i) => {
    const mx = d.temperature_2m_max[i], mn = d.temperature_2m_min[i], ch = d.precipitation_sum[i];
    if (Number(t.slice(5, 7)) === mes && mx != null && mn != null && ch != null) dias.push({ max: mx, min: mn, chuva: ch });
  });
  if (dias.length < 20) return null;
  const media = (f: (x: (typeof dias)[number]) => number) => dias.reduce((s, x) => s + f(x), 0) / dias.length;
  const porMes = new Date(Date.UTC(2001, mes, 0)).getUTCDate();
  return {
    tmin: Math.round(media((x) => x.min)),
    tmax: Math.round(media((x) => x.max)),
    diasChuva: Math.round((dias.filter((x) => x.chuva >= 1).length / dias.length) * porMes),
  };
}

export async function climaDoMes(destinationId: number, lat: number, lng: number, inicio: string): Promise<ClimaMes | null> {
  const mes = Number(inicio.slice(5, 7));
  if (!(mes >= 1 && mes <= 12)) return null;
  try {
    const [c] = await sql<{ tmin: number; tmax: number; dias_chuva: number }[]>`
      SELECT tmin, tmax, dias_chuva FROM clima_mes
      WHERE destination_id = ${destinationId} AND mes = ${mes} AND buscado_em > now() - interval '1 year'`;
    if (c) return { mes, tmin: c.tmin, tmax: c.tmax, diasChuva: c.dias_chuva };
    const b = await buscar(lat, lng, mes);
    if (!b) return null;
    await sql`
      INSERT INTO clima_mes (destination_id, mes, tmin, tmax, dias_chuva) VALUES (${destinationId}, ${mes}, ${b.tmin}, ${b.tmax}, ${b.diasChuva})
      ON CONFLICT (destination_id, mes) DO UPDATE SET tmin = EXCLUDED.tmin, tmax = EXCLUDED.tmax, dias_chuva = EXCLUDED.dias_chuva, buscado_em = now()`;
    return { mes, ...b };
  } catch {
    return null;
  }
}
