// Base inicial: Lisboa, o destino usado no protótipo. Entra no banco só na
// primeira vez (quando ainda não existe nenhum destino); depois disso, tudo
// é editado pelo painel da agência.

type SeedPoi = {
  nome: string; cat: string; bairro: string; lat: number; lng: number; dur: number;
  abre: string; fecha: string; preco: number; reserva?: boolean; indoor: boolean; meal?: boolean;
  tags: string[]; closedDays?: number[]; tip?: string; historia?: string;
  curiosidades?: string[]; datas?: { ano: string; txt: string }[]; source: string;
};

export const SEED_DESTINATION = {
  nome: "Lisboa", pais: "Portugal", lat: 38.7223, lng: -9.1393, moeda: "€",
  updateFreq: "Semanal", cor1: "#FFB21E", cor2: "#F7845E",
};

export const SEED_POIS: SeedPoi[] = [
  {
    nome: "Mosteiro dos Jerónimos", cat: "Museu", bairro: "Belém", lat: 38.6979, lng: -9.2068, dur: 90,
    abre: "09:30", fecha: "18:00", preco: 2, reserva: true, indoor: true, tags: ["história", "arquitetura"],
    closedDays: [1], source: "Curadoria", tip: "Chegue na abertura: depois das 11h as filas ficam longas.",
    historia: "Encomendado pelo rei D. Manuel I e iniciado em 1501, o mosteiro foi erguido perto do ponto de onde partiam as naus das Grandes Navegações e é o maior exemplo do estilo manuelino. Foi entregue à Ordem de São Jerónimo, que rezava pelos navegadores e pela alma do rei.",
    curiosidades: ["Os túmulos de Vasco da Gama e de Luís de Camões ficam na igreja do mosteiro.", "A obra foi financiada em boa parte com o lucro do comércio de especiarias."],
    datas: [{ ano: "1501", txt: "Início da obra" }, { ano: "1983", txt: "Patrimônio Mundial da UNESCO" }],
  },
  {
    nome: "Torre de Belém", cat: "Atração", bairro: "Belém", lat: 38.6916, lng: -9.2160, dur: 60,
    abre: "09:30", fecha: "18:00", preco: 2, indoor: false, tags: ["história", "fotografia"], closedDays: [1],
    source: "Curadoria",
    historia: "Construída entre 1514 e 1519 para proteger a entrada de Lisboa pelo rio Tejo, a torre ficava originalmente sobre uma pequena ilha no rio. Com o tempo, a margem avançou e ela passou a ficar quase colada à terra. Virou símbolo da época das Grandes Navegações.",
    curiosidades: ["Uma das esculturas da fachada é um rinoceronte, lembrança do animal que chegou a Lisboa em 1515 como presente ao rei.", "O projeto é do arquiteto Francisco de Arruda.", "Ao longo dos séculos, também serviu de farol, alfândega e prisão."],
    datas: [{ ano: "1514", txt: "Início da obra" }, { ano: "1519", txt: "Conclusão" }, { ano: "1983", txt: "Patrimônio Mundial da UNESCO" }],
  },
  {
    nome: "Padrão dos Descobrimentos", cat: "Atração", bairro: "Belém", lat: 38.6936, lng: -9.2057, dur: 40,
    abre: "10:00", fecha: "19:00", preco: 1, indoor: false, tags: ["história", "fotografia"], source: "Google Places",
    historia: "O monumento atual, de 1960, marcou os 500 anos da morte do Infante D. Henrique. Na proa estão o Infante e outras figuras da época das Grandes Navegações. Do topo, a vista pega o rio, a Torre de Belém e o Mosteiro dos Jerónimos.",
    datas: [{ ano: "1960", txt: "Inauguração do monumento em pedra" }],
  },
  {
    nome: "Pastéis de Belém", cat: "Gastronomia", bairro: "Belém", lat: 38.6975, lng: -9.2032, dur: 30,
    abre: "08:00", fecha: "23:00", preco: 1, indoor: true, tags: ["gastronomia"], source: "Google Places",
    tip: "A fila do balcão anda rápido; para comer sentado, entre direto nos salões dos fundos.",
    historia: "A fábrica vende, desde 1837, os pastéis feitos a partir da receita que veio do Mosteiro dos Jerónimos, ao lado. A receita original continua guardada em segredo.",
    datas: [{ ano: "1837", txt: "Abertura da fábrica" }],
  },
  {
    nome: "MAAT", cat: "Museu", bairro: "Belém", lat: 38.6959, lng: -9.1934, dur: 75,
    abre: "10:00", fecha: "19:00", preco: 2, indoor: true, tags: ["arquitetura", "cultura"], closedDays: [2],
    source: "Google Places", tip: "Mesmo sem entrar nas exposições, dá para subir na cobertura e ver o rio.",
  },
  {
    nome: "LX Factory", cat: "Compras", bairro: "Alcântara", lat: 38.7034, lng: -9.1785, dur: 90,
    abre: "10:00", fecha: "23:59", preco: 1, indoor: true, meal: true, tags: ["compras", "experiências locais"],
    source: "Google Places", historia: "Antigo complexo industrial do século XIX transformado em espaço de lojas, restaurantes e estúdios criativos.",
  },
  {
    nome: "Time Out Market", cat: "Gastronomia", bairro: "Cais do Sodré", lat: 38.7071, lng: -9.1458, dur: 75,
    abre: "10:00", fecha: "23:59", preco: 2, indoor: true, meal: true, tags: ["gastronomia"], source: "Google Places",
    tip: "No almoço de fim de semana fica cheio; vá antes das 12h30.",
  },
  {
    nome: "Castelo de São Jorge", cat: "Atração", bairro: "Castelo", lat: 38.7139, lng: -9.1335, dur: 90,
    abre: "09:00", fecha: "21:00", preco: 2, indoor: false, tags: ["história", "fotografia"], source: "Google Places",
    historia: "No alto da colina mais antiga de Lisboa, a fortificação foi tomada dos mouros em 1147 por D. Afonso Henriques, primeiro rei de Portugal, e depois virou residência real. Das muralhas se vê a Baixa, o Tejo e a Ponte 25 de Abril.",
    datas: [{ ano: "1147", txt: "Conquista de Lisboa por D. Afonso Henriques" }],
  },
  {
    nome: "Caminhada por Alfama", cat: "Experiência", bairro: "Alfama", lat: 38.7118, lng: -9.1300, dur: 90,
    abre: "00:00", fecha: "23:59", preco: 0, indoor: false, tags: ["experiências locais", "fotografia"], source: "Curadoria",
    tip: "Comece no Miradouro de Santa Luzia e desça sem pressa pelos becos até o rio.",
    historia: "O bairro mais antigo de Lisboa sobreviveu em boa parte ao terremoto de 1755 e mantém o traçado de ruas estreitas e escadarias da época moura.",
  },
  {
    nome: "Miradouro da Senhora do Monte", cat: "Atração", bairro: "Graça", lat: 38.7190, lng: -9.1328, dur: 30,
    abre: "00:00", fecha: "23:59", preco: 0, indoor: false, tags: ["fotografia"], source: "OpenStreetMap",
    tip: "É o miradouro mais alto da cidade; o pôr do sol daqui vale a subida.",
  },
  {
    nome: "Miradouro de São Pedro de Alcântara", cat: "Atração", bairro: "Bairro Alto", lat: 38.7155, lng: -9.1446, dur: 30,
    abre: "00:00", fecha: "23:59", preco: 0, indoor: false, tags: ["fotografia"], source: "OpenStreetMap",
  },
  {
    nome: "Museu Nacional do Azulejo", cat: "Museu", bairro: "Xabregas", lat: 38.7247, lng: -9.1137, dur: 90,
    abre: "10:00", fecha: "18:00", preco: 1, indoor: true, tags: ["cultura", "arquitetura"], closedDays: [1], source: "Google Places",
    historia: "Funciona no antigo Convento da Madre de Deus, fundado em 1509 pela rainha D. Leonor, e conta a história do azulejo em Portugal do século XV até hoje.",
    curiosidades: ["Um dos destaques é um grande painel de azulejos com a vista de Lisboa antes do terremoto de 1755."],
  },
  {
    nome: "Taberna da Rua das Flores", cat: "Restaurante", bairro: "Chiado", lat: 38.7101, lng: -9.1441, dur: 75,
    abre: "12:00", fecha: "23:00", preco: 2, indoor: true, meal: true, tags: ["gastronomia"], source: "Curadoria",
    tip: "Não aceita reserva; chegue cedo para o almoço.",
  },
  {
    nome: "Elétrico 28", cat: "Experiência", bairro: "Baixa", lat: 38.7154, lng: -9.1365, dur: 45,
    abre: "07:00", fecha: "22:00", preco: 1, indoor: false, tags: ["experiências locais"], source: "Curadoria",
    tip: "Embarque no ponto inicial, no Martim Moniz, para conseguir lugar sentado.",
  },
  {
    nome: "Oceanário de Lisboa", cat: "Atração", bairro: "Parque das Nações", lat: 38.7635, lng: -9.0937, dur: 120,
    abre: "10:00", fecha: "19:00", preco: 3, indoor: true, tags: ["natureza", "família"], source: "Google Places",
    historia: "Inaugurado em 1998 para a Expo 98, é um dos maiores aquários da Europa, com um grande tanque central que representa o oceano aberto.",
    datas: [{ ano: "1998", txt: "Inauguração, na Expo 98" }],
  },
  {
    nome: "Jantar com fado em Alfama", cat: "Vida noturna", bairro: "Alfama", lat: 38.7105, lng: -9.1297, dur: 120,
    abre: "19:30", fecha: "23:59", preco: 3, reserva: true, indoor: true, meal: true, tags: ["cultura", "gastronomia"], source: "Curadoria",
    historia: "O fado nasceu nos bairros populares de Lisboa no século XIX e foi reconhecido pela UNESCO como Patrimônio Cultural Imaterial da Humanidade em 2011.",
  },
  {
    nome: "Praça do Comércio", cat: "Atração", bairro: "Baixa", lat: 38.7076, lng: -9.1365, dur: 30,
    abre: "00:00", fecha: "23:59", preco: 0, indoor: false, tags: ["história", "fotografia"], source: "OpenStreetMap",
    historia: "No lugar do antigo Paço da Ribeira, destruído pelo terremoto de 1755, a praça foi refeita no plano de reconstrução do Marquês de Pombal, aberta para o rio. O Arco da Rua Augusta, ao norte, foi concluído em 1873.",
    curiosidades: ["Foi aqui que o rei D. Carlos I foi assassinado, em 1908."],
    datas: [{ ano: "1755", txt: "Terremoto destrói o Paço da Ribeira" }, { ano: "1873", txt: "Conclusão do Arco da Rua Augusta" }],
  },
  {
    nome: "Sé de Lisboa", cat: "Atração", bairro: "Baixa", lat: 38.7098, lng: -9.1335, dur: 40,
    abre: "09:30", fecha: "19:00", preco: 1, indoor: true, tags: ["história", "arquitetura"], source: "Google Places",
    historia: "A catedral começou a ser construída logo depois da conquista cristã de Lisboa, em 1147, e é a igreja mais antiga da cidade.",
  },
  {
    nome: "Museu Calouste Gulbenkian", cat: "Museu", bairro: "Avenidas Novas", lat: 38.7375, lng: -9.1545, dur: 100,
    abre: "10:00", fecha: "18:00", preco: 2, indoor: true, tags: ["cultura", "arquitetura"], closedDays: [2], source: "Google Places",
    tip: "O jardim da fundação é aberto e gratuito, ótimo para uma pausa.",
  },
  {
    nome: "Cervejaria Ramiro", cat: "Restaurante", bairro: "Intendente", lat: 38.7206, lng: -9.1356, dur: 75,
    abre: "12:00", fecha: "23:59", preco: 2, indoor: true, meal: true, tags: ["gastronomia"], closedDays: [1], source: "Google Places",
    tip: "Frutos do mar por peso; termine com o prego no pão, como os locais.",
  },
  {
    nome: "Livraria Bertrand", cat: "Compras", bairro: "Chiado", lat: 38.7108, lng: -9.1418, dur: 30,
    abre: "09:00", fecha: "22:00", preco: 0, indoor: true, tags: ["cultura"], source: "Google Places",
    historia: "Fundada em 1732, é considerada a livraria mais antiga do mundo ainda em funcionamento.",
    datas: [{ ano: "1732", txt: "Fundação" }],
  },
  {
    nome: "Jardim do Príncipe Real", cat: "Parque", bairro: "Príncipe Real", lat: 38.7166, lng: -9.1484, dur: 45,
    abre: "00:00", fecha: "23:59", preco: 0, indoor: false, tags: ["natureza"], source: "OpenStreetMap",
    tip: "Repare no cedro centenário, cujos galhos formam um grande guarda-sol.",
  },
  {
    nome: "Museu Nacional de Arte Contemporânea", cat: "Museu", bairro: "Chiado", lat: 38.7094, lng: -9.1418, dur: 60,
    abre: "10:00", fecha: "18:00", preco: 1, indoor: true, tags: ["cultura"], closedDays: [1], source: "Google Places",
  },
  {
    nome: "Museu do Oriente", cat: "Museu", bairro: "Alcântara", lat: 38.7037, lng: -9.1718, dur: 75,
    abre: "10:00", fecha: "18:00", preco: 1, indoor: true, tags: ["cultura", "história"], closedDays: [1], source: "Google Places",
  },
  {
    nome: "Mercado de Campo de Ourique", cat: "Gastronomia", bairro: "Campo de Ourique", lat: 38.7167, lng: -9.1660, dur: 60,
    abre: "10:00", fecha: "23:00", preco: 1, indoor: true, meal: true, tags: ["gastronomia"], source: "Google Places",
  },
];
