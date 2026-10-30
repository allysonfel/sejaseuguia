import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { dentroDoLimite, ipDe } from "@/lib/limiteRequisicoes";

// Freio de volume por IP (janela de 1 min). O geral pega tudo; as rotas que custam
// (login e cadastro, IA, e-mail, exportação, importação) têm limite próprio, mais baixo.
const LIMITE_GERAL = 240;
const LIMITES: [prefixo: string, max: number][] = [
  ["/api/auth/recover", 5],
  ["/api/auth/signup", 10],
  ["/api/auth/", 20],
  ["/api/identify", 10],
  // O app acompanha a pesquisa de 3 em 3 s (até 2 min); quem começa pesquisa no Gemini tem freio próprio por pessoa e por dia.
  ["/api/trips/pesquisa", 40],
  ["/api/assistant", 20],
  ["/api/me/export", 5],
  ["/api/me/excluir", 10],
  ["/api/pedidos", 10],
  ["/api/admin/travelers.csv", 10],
  ["/api/geo/search", 60],
];

function muitas(esperarSeg: number, api: boolean) {
  const headers = { "Retry-After": String(esperarSeg) };
  return api
    ? Response.json({ error: "Muitas requisições. Aguarde um pouco e tente de novo." }, { status: 429, headers })
    : new NextResponse("Muitas requisições. Aguarde um pouco e tente de novo.", { status: 429, headers });
}

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const api = path.startsWith("/api/");
  const ip = ipDe(req.headers);

  // Aviso do provedor de pagamento: tem segredo próprio e chega em rajada; fica fora do freio de volume.
  if (path === "/api/pagamentos/cakto") return NextResponse.next();
  const geral = dentroDoLimite(`g:${ip}`, LIMITE_GERAL);
  if (!geral.ok) return muitas(geral.esperarSeg, api);
  // PDF do roteiro (/api/trips/<id>/pdf): pesado, monta o documento. O acompanhamento do guia (?preparar=1,
  // de 3 em 3 s enquanto pesquisa) tem limite à parte para não gastar o do download.
  const pdf = /^\/api\/trips\/\d+\/pdf$/.test(path) ? (req.nextUrl.searchParams.get("preparar") === "1" ? ["pdf-preparar", 40] as [string, number] : ["pdf", 10] as [string, number]) : undefined;
  const regra: [string, number] | undefined = pdf ?? LIMITES.find(([p]) => path.startsWith(p));
  if (regra) {
    const r = dentroDoLimite(`${regra[0]}:${ip}`, regra[1]);
    if (!r.ok) return muitas(r.esperarSeg, api);
  }

  // Checagem otimista: sem sessão válida do tipo certo, volta pro login.
  // A autorização de verdade (perfil da equipe, dono da viagem) fica nas páginas e nas rotas /api.
  const area = (p: string) => path === p || path.startsWith(p + "/");
  if (area("/app") || area("/admin")) {
    const s = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
    const staffArea = area("/admin");
    if (!s || s.kind !== (staffArea ? "staff" : "traveler")) {
      const url = new URL("/entrar", req.url);
      if (staffArea) url.searchParams.set("equipe", "1");
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

// Tudo, menos arquivos estáticos.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff2?|mp3)$).*)"],
};
