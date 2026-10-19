// Telefones de emergência dos países do catálogo (chave: ISO 3166-1 alfa-2).
// Dado fixo, sem IA e sem chamada externa: erro aqui custa caro. Conferido em
// 2026-10-19; ao entrar país novo no catálogo, incluir aqui.
//
// Plantão consular do Itamaraty (24 h, só emergência: acidente, prisão,
// desaparecimento, morte). Cada embaixada e consulado tem o próprio plantão no site.
export const PLANTAO_CONSULAR = "+55 61 98260-0610";
export const PORTAL_CONSULAR = "https://www.gov.br/mre/pt-br/assuntos/portal-consular";

export type Telefone = { nome: string; numero: string };

// geral: número único que atende tudo (112, 911...). Os outros só quando o país separa.
type Pais = { geral?: string; policia?: string; ambulancia?: string; bombeiros?: string; turista?: string };

const P: Record<string, Pais> = {
  AE: { policia: "999", ambulancia: "998", bombeiros: "997" },
  AR: { geral: "911", ambulancia: "107", bombeiros: "100" },
  AT: { geral: "112", policia: "133", ambulancia: "144", bombeiros: "122" },
  AU: { geral: "000" },
  BE: { geral: "112", policia: "101" },
  CA: { geral: "911" },
  CH: { geral: "112", policia: "117", ambulancia: "144", bombeiros: "118" },
  CL: { policia: "133", ambulancia: "131", bombeiros: "132" },
  CN: { policia: "110", ambulancia: "120", bombeiros: "119" },
  CO: { geral: "123" },
  CU: { policia: "106", ambulancia: "104", bombeiros: "105" },
  CZ: { geral: "112", policia: "158", ambulancia: "155", bombeiros: "150" },
  DE: { geral: "112", policia: "110" },
  DK: { geral: "112" },
  DO: { geral: "911" },
  EG: { policia: "122", ambulancia: "123", bombeiros: "180", turista: "126" },
  ES: { geral: "112", policia: "091" },
  FR: { geral: "112", policia: "17", ambulancia: "15", bombeiros: "18" },
  GB: { geral: "999" },
  GR: { geral: "112", policia: "100", ambulancia: "166", bombeiros: "199", turista: "1571" },
  HK: { geral: "999" },
  HR: { geral: "112", policia: "192", ambulancia: "194", bombeiros: "193" },
  HU: { geral: "112" },
  ID: { geral: "112", policia: "110", ambulancia: "118", bombeiros: "113" },
  IE: { geral: "112" },
  IL: { policia: "100", ambulancia: "101", bombeiros: "102" },
  IN: { geral: "112", ambulancia: "108" },
  IS: { geral: "112" },
  IT: { geral: "112", policia: "113", ambulancia: "118", bombeiros: "115" },
  JP: { policia: "110", ambulancia: "119", bombeiros: "119" },
  KH: { policia: "117", ambulancia: "119", bombeiros: "118" },
  KR: { policia: "112", ambulancia: "119", bombeiros: "119" },
  MA: { policia: "19", ambulancia: "15", bombeiros: "15" },
  MO: { geral: "999" },
  MV: { policia: "119", ambulancia: "102", bombeiros: "118" },
  MX: { geral: "911" },
  MY: { geral: "999" },
  NL: { geral: "112" },
  PE: { policia: "105", ambulancia: "106", bombeiros: "116" },
  PH: { geral: "911" },
  PL: { geral: "112", policia: "997", ambulancia: "999", bombeiros: "998" },
  PT: { geral: "112" },
  QA: { geral: "999" },
  RU: { geral: "112", policia: "102", ambulancia: "103", bombeiros: "101" },
  SA: { geral: "911" },
  SE: { geral: "112" },
  SG: { policia: "999", ambulancia: "995", bombeiros: "995" },
  TH: { policia: "191", ambulancia: "1669", bombeiros: "199", turista: "1155" },
  TR: { geral: "112" },
  TW: { policia: "110", ambulancia: "119", bombeiros: "119" },
  US: { geral: "911" },
  UY: { geral: "911" },
  VN: { policia: "113", ambulancia: "115", bombeiros: "114" },
  ZA: { geral: "112", policia: "10111", ambulancia: "10177" },
};

/** Telefones do país, na ordem de uso. null: Brasil, país fora da lista ou sem o código. */
export function telefonesDe(iso: string | null): Telefone[] | null {
  const p = iso && iso !== "BR" ? P[iso.toUpperCase()] : undefined;
  if (!p) return null;
  const l: Telefone[] = [];
  if (p.geral) l.push({ nome: "Emergência (atende tudo)", numero: p.geral });
  // Mesmo número para ambulância e bombeiros vira uma linha só.
  if (p.policia) l.push({ nome: "Polícia", numero: p.policia });
  if (p.ambulancia && p.ambulancia === p.bombeiros) l.push({ nome: "Ambulância e bombeiros", numero: p.ambulancia });
  else {
    if (p.ambulancia) l.push({ nome: "Ambulância", numero: p.ambulancia });
    if (p.bombeiros) l.push({ nome: "Bombeiros", numero: p.bombeiros });
  }
  if (p.turista) l.push({ nome: "Polícia turística", numero: p.turista });
  return l;
}

/** Link tel: (sem espaços). */
export const tel = (n: string) => "tel:" + n.replace(/[^\d+]/g, "");

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const PERGUNTA = /\b(emergencia\w*|policia|ambulancia|bombeiro\w*|samu|socorro|sos|consulado|embaixada|plantao consular|fui assaltad\w*|fui roubad\w*|roubaram|perdi (o |meu )?passaporte|numero (de|da|do) (emergencia|policia|ambulancia|hospital))\b/;

export const ehEmergencia = (q: string) => PERGUNTA.test(norm(q));

/** Resposta fixa (nunca da IA) para dúvida de emergência, com os números do país da viagem. */
export function duvidaEmergencia(q: string, viagem: { pais: string; paisIso: string | null } | null): string | null {
  if (!ehEmergencia(q)) return null;
  const consulado = `Para assalto, passaporte perdido ou outra emergência com brasileiro, procure a embaixada ou o consulado do Brasil mais perto (o plantão está no site deles) ou o plantão consular do Itamaraty, 24 horas: ${PLANTAO_CONSULAR}.`;
  const l = viagem ? telefonesDe(viagem.paisIso) : null;
  if (!viagem || viagem.paisIso === "BR") return "No Brasil: Polícia 190, SAMU 192, Bombeiros 193.";
  if (!l) return `Não tenho os números de emergência de ${viagem.pais} guardados. ${consulado}`;
  return `Em ${viagem.pais}: ${l.map((t) => `${t.nome} ${t.numero}`).join(", ")}. ${consulado} Os números ficam também no fim da aba Reservas da viagem.`;
}
