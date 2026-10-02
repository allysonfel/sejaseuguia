# Seja Seu Guia

App de roteiros de viagem: o viajante conta como gosta de viajar, escolhe destino, datas e hotel, e o motor monta o roteiro dia a dia e reorganiza tudo quando os planos mudam. Junto vem o painel da agência (Lux Viagens e Turismo) para cuidar da base de lugares, das regras do motor, da equipe e da LGPD.

Começou como o protótipo navegável publicado em `logoscompany.io/p/sejaseuguia`. O visual é o mesmo (o CSS e os ícones foram extraídos do protótipo para `src/app/prototype.css` e `src/lib/icons.ts`); os dados fixos viraram banco de dados e as telas viraram funcionalidades de verdade.

Projeto independente do logoscompany (fica ao lado dele, em `DesktopLogossejaseuguia`): tem `package.json`, `node_modules` e banco próprios.

## Rodar

```bash
cd Desktop/Logos/sejaseuguia
npm install
cp .env.example .env.local   # preencha DATABASE_URL, SESSION_SECRET e o acesso inicial da equipe
npm run dev                  # http://localhost:3100
```

Na primeira requisição o app cria as tabelas sozinho (mesmo padrão `ensureSchema` do logoscompany), carrega Lisboa com 25 lugares e cria o primeiro acesso da equipe com `ADMIN_EMAIL` / `ADMIN_PASSWORD`, se ainda não existir ninguém na equipe.

- Viajante: `/entrar`, aba Viajante, "Criar conta grátis".
- Equipe: `/entrar`, aba Equipe (ou `/entrar?equipe=1`).

## O que tem

**App do viajante** (`/app`, pensado para o celular)
- Cadastro com consentimento, login, recuperação de senha por link (e-mail via Resend; sem chave, o link sai no log do servidor).
- Perfil de viajante em 4 passos (companhia, interesses, ritmo, orçamento, locomoção, o que evitar).
- Nova viagem: destino, datas, hotel (busca no OpenStreetMap/Nominatim ou toque no mapa) e quantos lugares do perfil ficam a 20 min do hotel.
- Roteiro gerado pelo motor, com horários, trajetos, tempo livre, "por que aqui?" e dica da curadoria.
- Replanejar com um toque: chuva, cansaço, atraso de 1 h, economizar; mover, remover (com alternativas perto), encaixar algo no tempo livre, levar o que sobrou para o dia seguinte, desfazer.
- Mapa real (Leaflet + OpenStreetMap) com a rota do dia; "navegar" abre o app de mapas do celular.
- Reservas: ligadas a um lugar viram horário travado no roteiro; voo no último dia faz o dia terminar 3 h antes. Avisa quando a reserva cai fora do horário de funcionamento.
- Pessoas: convite por e-mail (pode editar ou só ver), link público somente leitura (`/v/<slug>`), opção de esconder as reservas no link.
- Modo Viagem: agora, próximo, depois, concluir, ficar mais tempo, pular; previsão do tempo real (Open-Meteo) com sugestão de troca quando vai chover.
- Assistente da viagem por regras (sem IA): entende pedidos como "está chovendo", "estou cansado", "quero um restaurante perto", "tire o museu e coloque algo ao ar livre" e mostra a prévia antes de aplicar.
- Explorar: lugares do destino no mapa, filtros, busca, adicionar ao roteiro.
- "O que é esse lugar?": usa a localização do celular para achar o lugar cadastrado mais perto e mostra história, curiosidades e datas (a foto não é analisada; ver abaixo).
- Avaliação pós-viagem: as notas por categoria pesam nos próximos roteiros.
- Privacidade: preferências, exportar os próprios dados (JSON) e pedir exclusão da conta.

**Painel da agência** (`/admin`)
- Visão geral com números reais: viajantes, roteiros, viagens em andamento, replanejamentos por motivo, saúde da base, destinos pedidos sem cobertura.
- Viajantes (busca e exportação CSV) e Viagens (filtro por status).
- Pontos de interesse: cadastro e edição com mapa, horários, dias fechados, faixa de preço, história. Lugar sem revisão há mais de 60 dias sai das sugestões até alguém marcar "Revisado".
- Destinos: cadastro, cores, frequência de revisão e lista do que os viajantes tentaram planejar.
- Motor de roteiros: pesos e regras em rascunho, publicação com versão e simulação que monta de novo as últimas viagens e compara com a versão publicada.
- Equipe e LGPD: convite com senha provisória, perfis (Administrador, Curador de conteúdo, Suporte, Financeiro), matriz de permissões aplicada nas páginas e na API, atendimento de pedidos de exportação e exclusão.

## Onde está cada coisa

| Caminho | O quê |
|---|---|
| `src/lib/engine.ts` | Motor de roteiros (puro, roda no servidor e no navegador) |
| `src/lib/assistant.ts` | Assistente por regras |
| `src/lib/db.ts` | Conexão, criação das tabelas e carga inicial |
| `src/lib/seedData.ts` | Lisboa e seus lugares |
| `src/lib/auth.ts`, `session.ts`, `password.ts` | Sessão (cookie assinado), senhas (scrypt), permissões |
| `src/proxy.ts` | Barra `/app` e `/admin` sem sessão (Next 16 chama o middleware de proxy) |
| `src/components/trip/` | Tela da viagem, Modo Viagem e o hook que salva o roteiro com controle de versão |
| `src/app/api/` | Rotas JSON do app e do painel |

## Diferenças em relação ao protótipo

- Sem IA, por decisão do projeto: o assistente e as explicações são por regras; a aba "Assistente IA" e a de custos de API do painel não existem. O "O que é esse lugar?" identifica pelo que está perto da localização, não pelo conteúdo da foto (o botão "Não é isso" deixa escolher entre os lugares próximos).
- Mapa ilustrado e navegação curva a curva dentro do app ficaram de fora: o mapa é o OpenStreetMap real e a navegação abre no app de mapas do celular.
- Login com Google/Apple e plano Plus ficaram de fora.
- Só Lisboa vem cadastrada. Os outros destinos do protótipo eram números de exemplo; novos destinos e lugares entram pelo painel.
