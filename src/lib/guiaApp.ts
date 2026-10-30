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
- Assistente: o Gui (mascote do app, uma bússola com olhos) fica no canto da tela (o balão "Fale comigo" aparece uma vez, por alguns segundos); tocar nele abre o chat. Dentro do Roteiro, ele também ajusta o dia.
- Início: "Planejar nova viagem" no topo (cartão grande); "Meus roteiros" com abas Atuais, Futuros e Realizados (viagem da vez com contagem regressiva); próximos compromissos (reservas); avisos no sino.
- Planejar nova viagem: escolhe destino, datas e hotel (busca pelo nome ou endereço; se não achar, "Não encontrei, marcar no mapa" no fim da lista deixa tocar no mapa onde a hospedagem fica, mantendo o nome digitado); o app monta o roteiro dia a dia sozinho, de acordo com o perfil de viajante: uma IA pesquisa no Google o que abre nas datas da viagem, horários, ingressos e agendamento (inclusive parques temáticos e lugares que ainda não estavam no app), e o app organiza a ordem, os horários e os trajetos. A pesquisa começa assim que destino, datas e hotel estão preenchidos e pode levar até 2 minutos. Botão "Montar meu roteiro" mostra antes as atrações escolhidas, separadas por dia, com foto; tocar numa atração abre um resumo do que ela é; e dá para tirar as que não quer (por exemplo, quem já conhece o destino); o app coloca outras no lugar quando couber. A opção "Sugerir restaurantes e cafés" pode ser desligada para o roteiro ter só pontos turísticos. Antes de montar, em "Já tem algo reservado?", dá para adicionar voo, ingressos ou restaurante já reservados: o roteiro nasce encaixado nesses horários e as reservas ficam guardadas na aba Reservas.
- Roteiro: no topo, o destino, as datas, o hotel e o clima típico do mês da viagem (temperatura e dias de chuva, média dos últimos anos; não é previsão). Logo abaixo do "Iniciar viagem", o botão "Baixar roteiro em PDF" gera o roteiro completo para guardar, imprimir ou mandar: resumo, sobre o destino, orientações (dinheiro, transporte, apps, alertas, telefones de emergência), gastronomia, dia a dia com horários, preço dos ingressos e link do Google Maps, resumo financeiro estimado, reservas importantes com site oficial e dicas. Na primeira vez pode levar até 2 minutos; depois sai na hora. Se o roteiro mudar (lugar trocado ou novo), o próximo PDF pesquisa só os lugares novos (preço e onde reservar) e leva uns 20 segundos. No app do celular (App Store e Google Play), o PDF abre a opção de salvar ou compartilhar do celular, e logo abaixo fica o botão "Receber lembretes da viagem no celular": avisa na véspera às 19h, no começo de cada dia e 1 hora antes de cada horário reservado (pede a permissão de notificação uma vez; no navegador não aparece). Lugar que costuma pedir reserva ou agendamento (por exemplo teatro, que funciona com programação, ou atração com ingresso por horário) aparece com o selo "Agende antes", também na prévia da Nova viagem; depois de reservar, é só guardar na aba Reservas. Dias da viagem com horários, trajetos e tempo entre lugares. Abas Roteiro, Mapa, Reservas e Pessoas. Dá para trocar, tirar, adiantar ou mover atividades. Cada trecho tem botões a pé, carro, ônibus e trem que abrem o Google Maps saindo de onde a pessoa está. No "Fim do dia", marca cada atração como realizada ou não realizada, e as não realizadas podem ir para o dia seguinte. Na aba Mapa, cada parada mostra a distância e o botão "Como ir", que abre a rota no Google Maps a partir da parada anterior. O Gui (botão do assistente), nessa tela, ajusta o dia (chuva, cansaço, atraso, restaurante, economizar).
- Reservas (aba do Roteiro): guardar voo, hotel, transfer, restaurante, passeio ou ingresso, aluguel de carro e seguro, com código ou localizador. Reserva ligada a um lugar fixa o horário dele no roteiro. Abaixo, "Costumam pedir reserva" lista os lugares do roteiro com fila ou ingresso por horário que ainda não têm reserva, com link do Google Maps e o botão "Já reservei" (abre a reserva já preenchida). Em viagem internacional, no fim da aba, o link "Telefones de emergência em <país>" abre polícia, ambulância, bombeiros e o plantão consular do Itamaraty.
- Pessoas (aba do Roteiro): "Convidar pessoa" por e-mail (entra com o próprio e-mail e vê o roteiro sempre atualizado) e link do roteiro (quem tem o link pode ver; dá para esconder as reservas no link). Só quem organiza a viagem muda essas opções.
- Modo viagem (botão do meio, embaixo): durante a viagem mostra o que fazer agora e a próxima parada, botão para navegar até lá, "Fiquei mais tempo" e aviso de chuva que reorganiza o resto do dia.
- O que é esse lugar? (aba "O que é?"): fotografar um monumento ou prédio e ver a história e curiosidades. Funciona mesmo sem localização (a IA reconhece pela foto); com localização, mostra também o que está perto. Tudo o que for reconhecido fica salvo em "Minhas descobertas", na mesma tela.
- Explorar lugares: mapa com lugares ao redor do hotel e o que já está no roteiro.
- Perfil: foto, nome, perfil de viajante, sons de comemoração, ajuda e suporte com a agência (e-mail), sair.
- Perfil de viajante: companhia, interesses, ritmo, horários (acordar cedo, horário intermediário ou atividades noturnas; o intermediário começa o dia às 9h30, sem programa à noite, e não combina com os outros dois), orçamento, como se locomove e o que evitar. Refazer muda as próximas sugestões. Tem um quiz divertido para descobrir o estilo.
- Privacidade e dados: consentimentos, exportar os dados e excluir a conta na hora (confirma com a senha; apaga conta, viagens criadas, reservas, avaliações e descobertas). Links para a política de privacidade e os termos de uso.
- Avaliar viagem: depois que a viagem termina, dar nota aos lugares visitados.`;

// Dúvidas comuns respondidas na hora, sem IA. Só entra quando a frase é claramente
// uma pergunta de "como faço" sobre um assunto do app.
const COMO = /\b(como|onde|cad[eê]|qual|quero|queria|posso|consigo|d[aá] pra|da para|tem como|preciso)\b/;
const FAQ: { termos: RegExp; t: string; ir?: Tela }[] = [
  { termos: /\b(convid\w*|compartilh\w*|adicionar (uma )?pessoa|chamar (minha|meu|alguem)|link do roteiro)\b/, t: "Na viagem, abra a aba Pessoas e toque em \"Convidar pessoa\". A pessoa entra com o próprio e-mail e vê o roteiro sempre atualizado. Ali também tem o link do roteiro para mandar a quem só precisa ver.", ir: "pessoas" },
  { termos: /\b(reserva\w*|localizador|passagem|voo|ingresso)\b/, t: "As reservas ficam na aba Reservas da viagem. Toque para adicionar, escolha o tipo e guarde o código. Se ligar a reserva a um lugar, o roteiro ajusta o horário dele. Ali também aparecem os lugares do roteiro que costumam pedir reserva, com o botão \"Já reservei\".", ir: "reservas" },
  { termos: /\b(nao (acho|achei|encontro|encontrei|aparece) ((o|a) )?((meu|minha) )?(hotel|hospedagem|pousada|endereco)|(hotel|hospedagem|pousada) nao (aparece|encontrad\w*)|marcar (o hotel|a hospedagem|no mapa))\b/, t: "Na Nova viagem, digite o nome do hotel ou o endereço. Se ele não aparecer na lista, toque em \"Não encontrei, marcar no mapa\", no fim da lista: o nome que você digitou fica, e é só tocar no mapa onde a hospedagem fica (dá para aproximar com os dedos).", ir: "nova" },
  { termos: /\b(nova viagem|planejar|criar (uma )?viagem|montar (uma )?viagem|outra viagem)\b/, t: "Toque em \"Planejar nova viagem\", no topo do Início, e escolha o destino, as datas e o hotel. Antes de montar, o app mostra as atrações escolhidas e você pode tirar as que não quer. Se já tiver voo, ingresso ou restaurante reservado, adicione em \"Já tem algo reservado?\" antes de montar. O roteiro dia a dia o app monta sozinho, seguindo o seu perfil de viajante e pesquisando no Google o que abre nas suas datas.", ir: "nova" },
  { termos: /\b(pdf|imprimir|impress\w*|baixar (o )?roteiro|salvar (o )?roteiro|roteiro (em|no) papel)\b/, t: "Abra a viagem e toque em \"Baixar roteiro em PDF\", logo abaixo do \"Iniciar viagem\". O PDF traz o dia a dia com horários, preço dos ingressos, onde reservar, dicas e um resumo de gastos. Na primeira vez pode levar até 2 minutos. Se você trocar ou incluir lugares, o PDF seguinte pesquisa os novos e leva uns 20 segundos.", ir: "roteiro" },
  { termos: /\b(lembretes?|notifica\w*|avis\w* no celular|alarme)\b/, t: "No app do celular, abra a viagem e toque em \"Receber lembretes da viagem no celular\", logo abaixo do botão do PDF. O app avisa na véspera, no começo de cada dia e 1 hora antes de cada horário reservado. Se você negou a permissão, libere as notificações do Seja Seu Guia nos ajustes do celular. No navegador os lembretes não aparecem.", ir: "roteiro" },
  { termos: /\b(demor\w*|lento|carregando|pesquisando)\b/, t: "Para montar o roteiro, o app pesquisa no Google o que abre nas suas datas, os horários e os ingressos de cada lugar. Isso pode levar até 2 minutos. A pesquisa começa assim que você preenche destino, datas e hotel, então ao tocar em \"Montar meu roteiro\" ela costuma já estar adiantada.", ir: "nova" },
  { termos: /\b(fotograf\w*|foto de (um|uma)|o que e esse lugar|monumento)\b/, t: "Use a aba \"O que é?\": fotografe o lugar e o app mostra a história e as curiosidades. Funciona mesmo sem localização, e o que for reconhecido fica salvo em \"Minhas descobertas\", na mesma tela.", ir: "descobrir" },
  { termos: /\b(minhas descobertas|descobertas|lugares que fotografei)\b/, t: "Ficam em \"Minhas descobertas\", na aba \"O que é?\". Toque em um lugar para ver de novo a história.", ir: "descobrir" },
  { termos: /\b(como (chego|chegar|ir)|google maps|de onibus|de trem|de carro|a pe ate|caminho ate)\b/, t: "No Roteiro, cada trecho tem os botões a pé, carro, ônibus e trem: o Google Maps abre saindo de onde você está. Na aba Mapa, o botão \"Como ir\" mostra a rota a partir da parada anterior.", ir: "roteiro" },
  { termos: /\b(realizad\w*|concluid\w*|fim do dia|nao deu tempo|dia seguinte|outro dia|remarcar)\b/, t: "No fim do dia do Roteiro, marque cada atração como realizada ou não realizada. As não realizadas podem ir para o dia seguinte com o botão \"Levar para o dia seguinte\", e o app reorganiza os horários.", ir: "roteiro" },
  { termos: /\b(perfil de viajante|meu perfil|meu estilo|quiz|interesses|ritmo)\b/, t: "No Perfil, toque em Perfil de viajante para mudar companhia, interesses, ritmo e orçamento. As próximas sugestões passam a seguir o novo perfil.", ir: "perfilViajante" },
  { termos: /\b(excluir (a |minha )?conta|apagar (a |minha )?conta|meus dados|exportar|privacidade|consentimento)\b/, t: "Em Privacidade e dados você vê os consentimentos e exporta seus dados. Para excluir a conta, toque em Excluir minha conta e confirme com a sua senha: a exclusão é na hora e não dá para desfazer.", ir: "privacidade" },
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
