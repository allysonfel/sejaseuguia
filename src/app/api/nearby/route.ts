import { apiTraveler, fail, ok } from "@/lib/api";
import { podeUsarAgora } from "@/lib/planos";
import { nearbyPois, validCoords } from "@/lib/nearby";

// Lugares cadastrados perto de uma coordenada (até 1,5 km), do mais perto pro mais longe.
export async function GET(req: Request) {
  const quem = await apiTraveler();
  if (!quem) return fail("Entre de novo para continuar.", 401);
  if (!(await podeUsarAgora(quem.id, "mapa"))) return fail("O mapa com a sua localização faz parte de um plano da viagem e vale de 48 horas antes até o fim dela.", 402);
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get("lat")), lng = Number(u.searchParams.get("lng"));
  if (!validCoords(lat, lng)) return fail("Localização inválida.");
  return ok({ pois: await nearbyPois(lat, lng) });
}
