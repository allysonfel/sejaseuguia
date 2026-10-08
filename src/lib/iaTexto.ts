// IA de texto (camada gratuita) para os lugares importados automaticamente:
// nome em português do Brasil e resumo da Wikipédia em inglês quando não há página em português.
// Só reescreve o que veio dos dados abertos: não inventa lugar, horário nem coordenada.
//   groq → gpt-oss-120b no Groq (rápido, resume bem). Chave: GROQ_API_KEY
//   glm  → GLM-4.5-Flash da Z.ai (grátis, reserva).     Chave: ZAI_API_KEY
// Ordem em IA_TEXTO_PROVEDOR (padrão "groq,glm").

export type ItemTraducao = { i: number; nome: string; texto: string };
export type Traducao = { nome: string; historia: string };

type Provedor = { nome: string; chave: () => string | undefined; url: string; corpo: () => Record<string, unknown> };

const PROVEDORES: Record<string, Provedor> = {
  groq: {
    nome: "groq", chave: () => process.env.GROQ_API_KEY, url: "https://api.groq.com/openai/v1/chat/completions",
    corpo: () => ({ model: process.env.GROQ_TEXTO_MODEL?.trim() || "openai/gpt-oss-120b", response_format: { type: "json_object" }, reasoning_effort: "low" }),
  },
  glm: {
    nome: "glm", chave: () => process.env.ZAI_API_KEY, url: "https://api.z.ai/api/paas/v4/chat/completions",
    corpo: () => ({ model: process.env.ZAI_TEXTO_MODEL?.trim() || "glm-4.5-flash", thinking: { type: "disabled" } }),
  },
};

const ordem = () =>
  (process.env.IA_TEXTO_PROVEDOR || "groq,glm").split(",").map((s) => PROVEDORES[s.trim().toLowerCase()]).filter((p): p is Provedor => !!p && !!p.chave());

export const iaTextoDisponivel = () => ordem().length > 0;

function prompt(cidade: string, pais: string, itens: ItemTraducao[]) {
  return `Você prepara nomes e textos de pontos turísticos de ${cidade} (${pais}) para um app de viagens brasileiro.
Para cada item:
- "nome": como um guia brasileiro escreveria. Traduza a parte genérica (Torre, Portão, Palácio, Igreja, Catedral, Fonte, Praia, Forte, Museu, Ponte, Praça) e mantenha o nome próprio no original. Ex.: "Sponza Palace" vira "Palácio Sponza"; "Clock tower" vira "Torre do Relógio"; "Maritime Museum" vira "Museu Marítimo".
  Santos e títulos religiosos em português: "St Blaise's Church" vira "Igreja de São Brás"; "St. Claire's convent" vira "Convento de Santa Clara"; "Holy Annunciation Church" vira "Igreja da Anunciação". Possessivo do inglês ('s) vira "de". Use "de/da/do" como em português ("Catedral de Dubrovnik"). Tire o ", ${cidade}" do fim e parênteses de desambiguação. Nome que já é só nome próprio fica igual. Nunca troque por outro lugar.
- "historia": se o item tiver "texto", um resumo de 2 a 3 frases em português do Brasil, só com o que está no texto (sem acrescentar fatos). Sem texto: "".
Português do Brasil correto e natural, sem palavras em inglês.
Responda só com JSON: {"itens":[{"i":0,"nome":"...","historia":"..."}]}
Itens: ${JSON.stringify(itens)}`;
}

async function chamar(p: Provedor, texto: string): Promise<string> {
  const res = await fetch(p.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${p.chave()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...p.corpo(), messages: [{ role: "user", content: texto }], temperature: 0.2, max_tokens: 2500 }),
    signal: AbortSignal.timeout(60_000),
  });
  const r = (await res.json().catch(() => ({}))) as { error?: { message?: string }; choices?: { message?: { content?: string } }[] };
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${r.error?.message ?? ""}`.slice(0, 300));
  return r.choices?.[0]?.message?.content ?? "";
}

function ler(texto: string, itens: ItemTraducao[]): Map<number, Traducao> {
  const out = new Map<number, Traducao>();
  const a = texto.indexOf("{"), b = texto.lastIndexOf("}");
  if (a < 0 || b <= a) return out;
  let j: { itens?: { i?: unknown; nome?: unknown; historia?: unknown }[] };
  try { j = JSON.parse(texto.slice(a, b + 1)); } catch { return out; }
  const validos = new Set(itens.map((x) => x.i));
  for (const x of j.itens ?? []) {
    const i = Number(x.i), nome = typeof x.nome === "string" ? x.nome.trim().slice(0, 120) : "";
    if (!validos.has(i) || !nome) continue;
    out.set(i, { nome, historia: typeof x.historia === "string" ? x.historia.trim().slice(0, 900) : "" });
  }
  return out;
}

// Limite por minuto do plano grátis: se o provedor pedir para esperar pouco ("try again in 5.8s"),
// espera e tenta de novo antes de passar para a reserva, que traduz pior.
async function comEspera(p: Provedor, texto: string, lote: ItemTraducao[]): Promise<Map<number, Traducao>> {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      return ler(await chamar(p, texto), lote);
    } catch (e) {
      const msg = (e as Error).message;
      const espera = /^HTTP 429/.test(msg) ? Number(/try again in ([\d.]+)s/i.exec(msg)?.[1] ?? NaN) : NaN;
      if (!(espera <= 20) || tentativa === 2) {
        console.error(`[ia-texto:${p.nome}]`, msg);
        break;
      }
      await new Promise((ok) => setTimeout(ok, espera * 1000 + 500));
    }
  }
  return new Map();
}

/** Traduz em lotes pequenos (o plano grátis limita tokens por minuto). Itens que falharem ficam fora do resultado. */
export async function traduzirLugares(cidade: string, pais: string, itens: ItemTraducao[]): Promise<Map<number, Traducao>> {
  const out = new Map<number, Traducao>();
  for (let k = 0; k < itens.length; k += 6) {
    const lote = itens.slice(k, k + 6);
    for (const p of ordem()) {
      const r = await comEspera(p, prompt(cidade, pais, lote), lote);
      if (r.size) { r.forEach((v, i) => out.set(i, v)); break; }
    }
    if (k + 6 < itens.length) await new Promise((ok) => setTimeout(ok, 1500));
  }
  return out;
}
