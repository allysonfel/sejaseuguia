// Chamada às rotas /api a partir dos componentes cliente.
export async function api<T = Record<string, unknown>>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error || "Algo deu errado. Tente de novo.");
    throw Object.assign(err, { status: res.status, data });
  }
  return data as T;
}

/** Abre a rota no Google Maps (navegação curva a curva fica com o app de mapas do celular). */
export function mapsLink(dest: { lat: number; lng: number }, origin?: { lat: number; lng: number } | null, modo?: string) {
  const travelmode = modo === "a pé" ? "walking" : modo === "transporte público" ? "transit" : "driving";
  const p = new URLSearchParams({ api: "1", destination: dest.lat + "," + dest.lng, travelmode });
  if (origin) p.set("origin", origin.lat + "," + origin.lng);
  return "https://www.google.com/maps/dir/?" + p.toString();
}
