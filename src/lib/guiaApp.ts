// O que o assistente sabe sobre o próprio app: telas, o que dá para fazer em cada uma
// e para onde pode levar o viajante. Usado pelas regras (dúvidas comuns, sem IA)
// e pelo texto que vai para a IA.

export const TELAS = {
  inicio: { nome: "Início", href: "/app" },
  nova: { nome: "Planejar nova viagem", href: "/app/nova-viagem" },
  roteiro: { nome: "Roteiro", href: "/app/roteiro" },
  reservas: { nome: "Reservas", href: "/app/roteiro?aba=reservas" },
  pessoas: { nome: "Pessoas da viagem", href: "/app/roteiro?aba=pessoas" },
  modo: { nome: "Modo viagem", href: "/app/modo-viagem" },
  descobrir: { nome: "O que é esse lugar?", href: "/app/descobrir" },
  explorar: { nome: "Explorar lugares", href: "/app/explorar" },
  perfil: { nome: "Perfil", href: "/app/perfil" },
  perfilViajante: { nome: "Perfil de viajante", href: "/app/perfil-viajante?voltar=/app/perfil" },
  privacidade: { nome: "Privacidade e dados", href: "/app/privacidade" },
} as const;
export type Tela = keyof typeof TELAS;
export const NOMES_TELAS = Object.keys(TELAS) as Tela[];

/** Nome da tela aberta, a partir do caminho. */
export function telaDoCaminho(path: string) {
  if (path === "/app") return "Início";
  if (/^\/app\/viagem\/\d+\/avaliar/.test(path)) return "Avaliar viagem";
  if (/\/modo-viagem$/.test(path)) return "Modo viagem";
  if (/^\/app\/(viagem\/\d+|roteiro)/.test(path)) return "Roteiro da viagem";
  const t = Object.values(TELAS).find((x) => x.href !== "/app" && path.startsWith(x.href.split("?")[0]));
  return t?.nome ?? "App";
}

export const GUIA = `Telas do app Seja Seu Guia (da agência Lux Viagens e Turismo):
- Início: viagem atual com contagem regressiva, próximos compromissos (reservas), outras viagens, avisos no sino.
- Planejar nova viagem: escolhe destino, datas e hotel; o app monta o roteiro dia a dia sozinho, de acordo com o perfil de viajante. Botão "Montar meu roteiro".
- Roteiro: dias da viagem com horários, trajetos e tempo entre lugares. Abas Roteiro, Mapa, Reservas e Pessoas. Dá para trocar, tirar, adiantar ou mover atividades, e marcar como feito. O botão roxo do assistente, nessa tela, ajusta o dia (chuva, cansaço, atraso, restaurante, economizar).
- Reservas (aba do Roteiro): guardar voo, hotel, transfer, restaurante, passeio ou ingresso, aluguel de carro e seguro, com código ou localizador. Reserva ligada a um lugar fixa o horário dele no roteiro.
- Pessoas (aba do Roteiro): "Convidar pessoa" por e-mail (entra com o próprio e-mail e vê o roteiro sempre atualizado) e link do roteiro (quem tem o link pode ver; dá para esconder as reservas no link). Só quem organiza a viagem muda essas opções.
- Modo viagem (botão do meio, embaixo): durante a viagem mostra o que fazer agora e a próxima parada, botão para navegar até lá, "Fiquei mais tempo" e aviso de chuva que reorganiza o resto do dia.
- O que é esse lugar? (aba "O que é?"): fotografar um monumento ou prédio e ver a história e curiosidades do que está perto.
- Explorar lugares: mapa com lugares ao redor do hotel e o que já está no roteiro.
- Perfil: foto, nome, perfil de viajante, sons de comemoração, ajuda e suporte com a agência (e-mail), sair.
- Perfil de viajante: companhia, interesses, ritmo, orçamento, como se locomove e o que evitar. Refazer muda as próximas sugestões. Tem um quiz divertido para descobrir o estilo.
- Privacidade e dados: consentimentos, exportar os dados ou pedir a exclusão da conta.
- Avaliar viagem: depois que a viagem termina, dar nota aos lugares visitados.`;

// Dúvidas comuns respondidas na hora, sem IA. Só entra quando a frase é claramente
// uma pergunta de "como faço" sobre um assunto do app.
const COMO = /\b(como|onde|cad[eê]|qual|quero|queria|posso|consigo|d[aá] pra|da para|tem como|preciso)\b/;
const FAQ: { termos: RegExp; t: string; ir?: Tela }[] = [
  { termos: /\b(convid\w*|compartilh\w*|adicionar (uma )?pessoa|chamar (minha|meu|alguem)|link do roteiro)\b/, t: "Na viagem, abra a aba Pessoas e toque em \"Convidar pessoa\". A pessoa entra com o próprio e-mail e vê o roteiro sempre atualizado. Ali também tem o link do roteiro para mandar a quem só precisa ver.", ir: "pessoas" },
  { termos: /\b(reserva\w*|localizador|passagem|voo|ingresso)\b/, t: "As reservas ficam na aba Reservas da viagem. Toque para adicionar, escolha o tipo e guarde o código. Se ligar a reserva a um lugar, o roteiro ajusta o horário dele.", ir: "reservas" },
  { termos: /\b(nova viagem|planejar|criar (uma )?viagem|montar (uma )?viagem|outra viagem)\b/, t: "Toque em \"Planejar nova viagem\", escolha o destino, as datas e o hotel. O roteiro dia a dia o app monta sozinho, seguindo o seu perfil de viajante.", ir: "nova" },
  { termos: /\b(fotograf\w*|foto de (um|uma)|o que e esse lugar|monumento)\b/, t: "Use a aba \"O que é?\": fotografe o lugar e o app mostra a história e as curiosidades do que está perto de você.", ir: "descobrir" },
  { termos: /\b(perfil de viajante|meu perfil|meu estilo|quiz|interesses|ritmo)\b/, t: "No Perfil, toque em Perfil de viajante para mudar companhia, interesses, ritmo e orçamento. As próximas sugestões passam a seguir o novo perfil.", ir: "perfilViajante" },
  { termos: /\b(excluir (a |minha )?conta|apagar (a |minha )?conta|meus dados|exportar|privacidade|consentimento)\b/, t: "Em Privacidade e dados você vê os consentimentos, exporta seus dados ou pede a exclusão da conta.", ir: "privacidade" },
  { termos: /\b(sair|deslogar|logout|trocar (a )?foto|mudar (o |meu )?nome)\b/, t: "No Perfil você troca a foto e o nome, e o botão Sair fica no fim da tela.", ir: "perfil" },
  { termos: /\b(suporte|falar com a agencia|atendimento|ajuda humana)\b/, t: "No Perfil, toque em \"Ajuda e suporte\" para mandar um e-mail para a agência.", ir: "perfil" },
  { termos: /\b(modo viagem)\b/, t: "O Modo viagem é o botão do meio, embaixo. Durante a viagem ele mostra o que fazer agora, a próxima parada e o caminho até lá.", ir: "modo" },
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

export function duvidaComum(q: string): { t: string; ir?: Tela } | null {
  const s = norm(q);
  if (!COMO.test(s) || s.split(" ").length > 16) return null;
  const achados = FAQ.filter((f) => f.termos.test(s));
  return achados.length === 1 ? achados[0] : null;
}

// Regras de entrada mudam e erro aqui custa caro: resposta fixa, nunca da IA.
const DOCUMENTOS = /\b(visto|passaporte|vacina\w*|etias|autorizacao (de entrada|eletronica)|documento\w* (para|pra) (viajar|entrar)|imigracao|seguro viagem obrigatorio)\b/;
export function duvidaDocumentos(q: string): string | null {
  return DOCUMENTOS.test(norm(q))
    ? "Regras de entrada (visto, passaporte, vacinas e autorizações eletrônicas) mudam com frequência, então não respondo de cabeça. Confira no Portal Consular do Itamaraty e no site do consulado do país, e a agência pode confirmar para você em Perfil, Ajuda e suporte."
    : null;
}
