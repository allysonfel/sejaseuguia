import { apiStaff, fail, ok, readBody } from "@/lib/api";
import { getRules } from "@/lib/data";
import { setSetting } from "@/lib/db";
import { parseRules } from "@/lib/rulesInput";
import { simulate } from "@/lib/simulate";
import type { Rules } from "@/lib/types";

// action "draft": guarda o rascunho; "publish": vira a versão usada nos novos roteiros;
// "simulate": compara o rascunho com a versão publicada nas últimas viagens.
export async function POST(req: Request) {
  if (!(await apiStaff("engine"))) return fail("Sem acesso.", 403);
  const b = await readBody<{ action: string; rules: Rules }>(req);
  const draft = parseRules(b.rules);
  if (b.action === "draft") {
    await setSetting("rules_draft", draft);
    return ok();
  }
  if (b.action === "publish") {
    const cur = await getRules();
    const next = { ...draft, version: (cur.version ?? 1) + 1, publishedAt: new Date().toISOString() };
    await setSetting("rules", next);
    await setSetting("rules_draft", draft);
    return ok({ version: next.version, publishedAt: next.publishedAt });
  }
  if (b.action === "simulate") {
    const r = await simulate(draft, await getRules());
    return ok(r);
  }
  return fail("Ação inválida.");
}
