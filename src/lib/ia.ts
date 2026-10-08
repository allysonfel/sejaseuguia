// Reconhecimento de lugares pela foto ("O que é esse lugar?") com IA de
// camada gratuita. Provedores tentados na ordem de IA_PROVEDOR (padrão
// "glm,groq"); quem não tem chave é pulado, e se um falha (cota grátis
// esgotada, "sobrecarregado") tenta o próximo:
//   glm  → GLM-4.6V-Flash da Z.ai (Zhipu), gratuito. Chave: ZAI_API_KEY
//   groq → Qwen 3.8 27B no Groq, camada gratuita (~8 mil tokens/min, cerca
//          de 2 fotos por minuto: serve de reserva). Chave: GROQ_API_KEY
//
// Camada gratuita: o provedor pode usar o conteúdo enviado para treinar
// os modelos dele. Por isso a foto vai reduzida, sem a coordenada (só a
// lista de lugares próximos), o prompt manda ignorar pessoas, e a foto nunca
// é guardada aqui.
import type { Near } from "./nearby";

export type Identificacao = {
  /** Lugar da nossa base que aparece na foto, quando a IA reconhece um. */
  poiId: number | null;
  confianca: "alta" | "media" | "baixa";
  /** A foto não mostra um lugar (selfie, comida, documento...). */
  naoELugar: boolean;
  nome: string;
  resposta: string;
  /** Detalhes visíveis na foto que valem a pena reparar (fachada, material, estilo...). */
  observar: string[];
  /** Contexto histórico/cultural em poucas frases; vazio quando a IA não tem certeza. */
  contexto: string;
  /** Dica prática de visita (melhor horário, o que fazer por perto, etiqueta). */
  dica: string;
  curiosidades: string[];
};

type Provedor = {
  nome: string;
  chave: () => string | undefined;
  chamar: (chave: string, prompt: string, fotoBase64: string, mime: string) => Promise<string>;
};

const TIMEOUT = 25_000;

const FORMATO = `Responda SÓ com um JSON neste formato, sem texto fora dele:
{"poiId": número ou null, "confianca": "alta" | "media" | "baixa", "naoELugar": true ou false, "nome": "texto", "resposta": "texto", "observar": ["texto"], "contexto": "texto", "dica": "texto", "curiosidades": ["texto"]}`;

function instrucao(destino: string | null, perto: Near[]): string {
  const lista = perto.length
    ? perto.map((p) => `- id ${p.id}: ${p.nome} (${p.cat}, ${p.bairro}, a ${p.dist} m)`).join("\n")
    : "(nenhum lugar cadastrado a menos de 1,5 km)";
  return `Você é o guia do app de viagens Seja Seu Guia. O viajante${destino ? ` está em ${destino} e` : ""} tirou a foto anexa e quer saber o que é.

Lugares da nossa base perto dele, do mais perto para o mais longe:
${lista}

Tarefa:
1. Veja se a foto mostra um dos lugares da lista. Se sim, coloque o id dele em poiId. Prefira a lista: ela vem da localização real do viajante. Compare a foto primeiro com os lugares a menos de 300 m: se a construção da foto combina com um deles, é ele. Só diga que é um lugar fora da lista se a foto claramente não for nenhum deles.
2. Se não for nenhum da lista mas você reconhecer o lugar com segurança, deixe poiId null e coloque o nome em "nome".
3. Se não reconhecer, deixe "nome" vazio, confianca "baixa", e na resposta diga isso com honestidade e descreva o que dá para ver (estilo, época provável, tipo de construção).
4. "Lugar" é prédio, monumento, igreja, museu, praça, rua, mirante, paisagem. Se a foto mostrar outra coisa (comida, doce, bebida, prato, pessoa, animal, objeto, documento), naoELugar true e poiId null; mesmo assim escreva a resposta sobre o que aparece.
5. "resposta": tom de guia simpático, 4 a 6 frases, falando direto com o viajante (você): o que é, para que serve ou servia, por que é importante e o que torna o lugar especial. Nada de datas, números ou nomes de que você não tenha certeza.
6. "observar": 2 a 4 itens curtos sobre detalhes que aparecem NA FOTO e valem a pena reparar (fachada, material, estilo arquitetônico, decoração, vista, ingredientes se for comida). Cada item com uma frase explicando o porquê.
7. "contexto": 2 a 4 frases de história ou cultura (quem construiu, época, estilo, papel na cidade). Só o que você sabe com segurança; se não souber, "".
8. "dica": 1 ou 2 frases práticas para quem está ali agora (melhor horário, o que não perder lá dentro, o que provar, o que fica perto). Se não souber, "".
9. "curiosidades": no máximo 4, curtas, só se tiver certeza. Lista vazia é melhor que curiosidade inventada.
10. Ignore pessoas que apareçam na foto: nunca descreva nem identifique ninguém.
11. Escreva tudo em português do Brasil correto e natural: nenhuma palavra em inglês, espanhol ou chinês; revise a concordância antes de responder.

${FORMATO}`;
}

// Os dois provedores usam o formato de chat da OpenAI (imagem em data URL).
async function chatCompativel(url: string, chave: string, corpo: Record<string, unknown>, prompt: string, foto: string, mime: string): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      ...corpo,
      messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: `data:${mime};base64,${foto}` } }, { type: "text", text: prompt }] }],
      temperature: 0.2,
      max_tokens: 1000,
    }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const r = (await res.json().catch(() => ({}))) as { error?: { message?: string }; choices?: { message?: { content?: string } }[] };
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${r.error?.message ?? ""}`);
  return r.choices?.[0]?.message?.content ?? "";
}

const glm: Provedor = {
  nome: "glm",
  chave: () => process.env.ZAI_API_KEY,
  chamar: (chave, prompt, foto, mime) =>
    chatCompativel("https://api.z.ai/api/paas/v4/chat/completions", chave, { model: process.env.ZAI_MODEL?.trim() || "glm-4.6v-flash", thinking: { type: "disabled" } }, prompt, foto, mime),
};

const groq: Provedor = {
  nome: "groq",
  chave: () => process.env.GROQ_API_KEY,
  chamar: (chave, prompt, foto, mime) =>
    chatCompativel("https://api.groq.com/openai/v1/chat/completions", chave, { model: process.env.GROQ_MODEL?.trim() || "qwen/qwen3.8-27b", response_format: { type: "json_object" } }, prompt, foto, mime),
};

const PROVEDORES: Record<string, Provedor> = { glm, groq };

function ordem(): Provedor[] {
  const nomes = (process.env.IA_PROVEDOR || "glm,groq").split(",").map((s) => s.trim().toLowerCase());
  return nomes.map((n) => PROVEDORES[n]).filter((p): p is Provedor => !!p && !!p.chave());
}

export const iaDisponivel = () => ordem().length > 0;

/** Devolve null quando nenhum provedor está configurado ou todos falham: quem chama segue só pela localização. */
export async function identificarLugar(fotoBase64: string, mime: string, destino: string | null, perto: Near[]): Promise<Identificacao | null> {
  const prompt = instrucao(destino, perto);
  for (const p of ordem()) {
    try {
      const texto = await comNovaTentativa(() => p.chamar(p.chave()!, prompt, fotoBase64, mime));
      const r = normalizar(lerJson(texto), perto);
      if (r) return r;
      console.error(`[ia:${p.nome}] resposta fora do formato`);
    } catch (e) {
      console.error(`[ia:${p.nome}] falhou:`, String((e as Error).message).slice(0, 300));
    }
  }
  return null;
}

// Camada grátis às vezes responde 429 "sobrecarregado" ou 5xx: mais uma tentativa depois de 1,5 s.
async function comNovaTentativa(fn: () => Promise<string>): Promise<string> {
  try {
    return await fn();
  } catch (e) {
    if (!/^HTTP (429|5\d\d)/.test((e as Error).message)) throw e;
    await new Promise((ok) => setTimeout(ok, 1500));
    return fn();
  }
}

// Alguns modelos embrulham o JSON em ```json ... ``` ou texto: pega o primeiro objeto.
function lerJson(texto: string): Partial<Identificacao> {
  const i = texto.indexOf("{"), f = texto.lastIndexOf("}");
  if (i < 0 || f <= i) return {};
  try {
    return JSON.parse(texto.slice(i, f + 1));
  } catch {
    return {};
  }
}

// O modelo pode devolver id fora da lista ou campos fora do formato: só passa o que confere.
function normalizar(r: Partial<Identificacao>, perto: Near[]): Identificacao | null {
  const resposta = typeof r.resposta === "string" ? r.resposta.trim().slice(0, 1400) : "";
  const txt = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const lista = (v: unknown, n: number) => (Array.isArray(v) ? v.filter((c): c is string => typeof c === "string" && !!c.trim()).slice(0, n).map((c) => c.trim().slice(0, 240)) : []);
  if (!resposta) return null;
  const id = Number(r.poiId);
  const poiId = r.poiId != null && perto.some((p) => p.id === id) ? id : null;
  return {
    poiId,
    confianca: r.confianca === "alta" || r.confianca === "media" ? r.confianca : "baixa",
    naoELugar: r.naoELugar === true,
    nome: typeof r.nome === "string" ? r.nome.trim().slice(0, 120) : "",
    resposta,
    observar: lista(r.observar, 4),
    contexto: txt(r.contexto, 700),
    dica: txt(r.dica, 400),
    curiosidades: lista(r.curiosidades, 4),
  };
}
