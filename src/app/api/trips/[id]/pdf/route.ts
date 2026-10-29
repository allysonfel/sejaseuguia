import { renderToBuffer } from "@react-pdf/renderer";
import { apiTraveler, fail, ok } from "@/lib/api";
import { getUserById } from "@/lib/auth";
import { climaDoMes } from "@/lib/clima";
import { getRules, getTripForUser, listReservations, poisForTrip } from "@/lib/data";
import { PLANTAO_CONSULAR, telefonesDe } from "@/lib/emergencia";
import { schedAll } from "@/lib/engine";
import { dmy, todayIso } from "@/lib/format";
import { obterGuia } from "@/lib/iaGuia";
import { terminouEm } from "@/lib/iaRoteiro";
import { RoteiroPdf } from "@/lib/pdf/RoteiroPdf";
import { DEFAULT_PROFILE } from "@/lib/types";

export const runtime = "nodejs";
// O guia pode estar sendo pesquisado (até 2 min) na primeira vez.
export const maxDuration = 180;

// Foto de capa só do Wikimedia (de onde o app busca as fotos dos destinos), JPEG ou PNG, até 4 MB.
// O link do Commons redireciona para a miniatura (thumb/upload.wikimedia.org): o endereço final também é conferido.
const WIKIMEDIA = new Set(["commons.wikimedia.org", "upload.wikimedia.org", "thumb.wikimedia.org"]);
async function fotoDeCapa(url: string | null): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !WIKIMEDIA.has(u.hostname)) return null;
    const res = await fetch(u, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "SejaSeuGuia/0.1" } });
    const tipo = res.headers.get("content-type") ?? "";
    if (!res.ok || !WIKIMEDIA.has(new URL(res.url).hostname) || !/^image\/(jpeg|png)/.test(tipo)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length <= 4 * 1024 * 1024 ? buf : null;
  } catch {
    return null;
  }
}

// Roteiro em PDF: quem organiza e quem foi convidado para a viagem.
// Com `?preparar=1` só começa (ou acompanha) a pesquisa do guia e responde na hora se ela terminou:
// o app chama de 3 em 3 s antes de baixar (o Safari do iPhone desiste de esperar uma resposta depois de 60 s).
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await apiTraveler();
  if (!u) return fail("Entre de novo para continuar.", 401);
  const trip = await getTripForUser(Number((await ctx.params).id), u);
  if (!trip) return fail("Viagem não encontrada.", 404);
  const owner = trip.ownerId === u.id ? u : await getUserById(trip.ownerId);
  const profile = owner?.profile ?? DEFAULT_PROFILE;
  if (new URL(req.url).searchParams.get("preparar") === "1") {
    const [pois, rules] = await Promise.all([poisForTrip(trip), getRules()]);
    const dias = schedAll(trip.days, { pois, hotel: trip.hotel, profile, rules, inicio: trip.inicio });
    const usados = [...new Map(dias.flatMap((d) => d.items.map((i) => [i.poi.id, i.poi]))).values()];
    return ok({ pronto: await terminouEm(obterGuia(trip, usados, profile)) });
  }
  const [pois, rules, reservas, clima, foto] = await Promise.all([
    poisForTrip(trip), getRules(), listReservations([trip.id]),
    climaDoMes(trip.destinationId, trip.hotel.lat, trip.hotel.lng, trip.inicio).catch(() => null),
    fotoDeCapa(trip.fotoUrl),
  ]);
  const dias = schedAll(trip.days, { pois, hotel: trip.hotel, profile, rules, inicio: trip.inicio });
  const usados = [...new Map(dias.flatMap((d) => d.items.map((i) => [i.poi.id, i.poi]))).values()];
  const guia = await obterGuia(trip, usados, profile);
  const telefones = telefonesDe(trip.paisIso);
  try {
    const pdf = await renderToBuffer(
      RoteiroPdf({
        trip, dias, guia, clima, profile, foto, telefones,
        plantaoConsular: telefones ? PLANTAO_CONSULAR : null,
        organizador: owner?.nome.split(" ")[0] ?? "um viajante",
        // Quem só vê a viagem não recebe os códigos das reservas.
        reservas: trip.access === "viewer" ? [] : reservas,
        geradoEm: dmy(todayIso()),
      }),
    );
    const nome = ("roteiro-" + trip.destino).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nome}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[pdf]", (e as Error).message.slice(0, 300));
    return fail("Não deu para gerar o PDF agora. Tente de novo em instantes.", 500);
  }
}
