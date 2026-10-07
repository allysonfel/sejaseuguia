import { apiTraveler, fail, ok } from "@/lib/api";
import { nearbyPois, validCoords } from "@/lib/nearby";

// Lugares cadastrados perto de uma coordenada (até 1,5 km), do mais perto pro mais longe.
export async function GET(req: Request) {
  if (!(await apiTraveler())) return fail("Entre de novo para continuar.", 401);
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get("lat")), lng = Number(u.searchParams.get("lng"));
  if (!validCoords(lat, lng)) return fail("Localização inválida.");
  return ok({ pois: await nearbyPois(lat, lng) });
}
