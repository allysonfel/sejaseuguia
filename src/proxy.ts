import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// Checagem otimista: sem sessão válida do tipo certo, volta pro login.
// A autorização de verdade (perfil da equipe, dono da viagem) fica nas páginas e nas rotas /api.
export async function proxy(req: NextRequest) {
  const s = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  const staffArea = req.nextUrl.pathname.startsWith("/admin");
  if (!s || s.kind !== (staffArea ? "staff" : "traveler")) {
    const url = new URL("/entrar", req.url);
    if (staffArea) url.searchParams.set("equipe", "1");
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*", "/admin/:path*"] };
