import { after } from "next/server";
import { apiStaff, fail, ok, readBody } from "@/lib/api";
import { ensureSchema } from "@/lib/db";
import { cancelarPreCarga, preCarregar, processarFila, resumoFila } from "@/lib/importFila";

// Pré-carga do catálogo pelo painel: GET acompanha a fila; POST inicia ou cancela.
export async function GET() {
  if (!(await apiStaff("dest"))) return fail("Sem acesso.", 403);
  await ensureSchema();
  return ok(await resumoFila());
}

export async function POST(req: Request) {
  if (!(await apiStaff("dest"))) return fail("Sem acesso.", 403);
  await ensureSchema();
  const b = await readBody<{ acao: "iniciar" | "cancelar" }>(req);
  if (b.acao === "cancelar") return ok({ n: await cancelarPreCarga(), resumo: await resumoFila() });
  if (b.acao !== "iniciar") return fail("Ação inválida.");
  const n = await preCarregar();
  after(() => processarFila());
  return ok({ n, resumo: await resumoFila() });
}
