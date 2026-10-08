import { apiStaff, fail, ok, str } from "@/lib/api";
import { buscarFotoDestino } from "@/lib/destFoto";

// Sugestão de foto para o formulário de destino (botão "Buscar foto").
export async function GET(req: Request) {
  if (!(await apiStaff("dest"))) return fail("Sem acesso.", 403);
  const u = new URL(req.url);
  const nome = str(u.searchParams.get("nome"), 60), lat = Number(u.searchParams.get("lat")), lng = Number(u.searchParams.get("lng"));
  if (!nome || !Number.isFinite(lat) || !Number.isFinite(lng)) return fail("Informe a cidade e marque o centro no mapa.");
  const foto = await buscarFotoDestino(nome, lat, lng);
  if (!foto) return fail("Não achamos uma foto aberta para esse destino. Cole o endereço de uma imagem.", 404);
  return ok({ foto });
}
