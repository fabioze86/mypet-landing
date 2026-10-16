// Conteúdo de /creators: página self-service para creators e influenciadores
// divulgarem a marca própria Cat Dog como afiliados do Mercado Livre e da
// Shopee. Não há cadastro com a My Pet: o creator escolhe o produto aqui, gera
// o link no programa de afiliados do marketplace e usa o material abaixo.
//
// Comissão é definida por cada marketplace (por categoria e campanha), então a
// página não cita percentual. Sem "atacado", "cotação" ou "loja" na copy.

export type Marketplace = {
  id: "mercado-livre" | "shopee";
  name: string;
  /** Página da Cat Dog / My Pet no marketplace. Vazio = botão escondido. */
  brandUrl: string;
  /** Página oficial do programa de afiliados. */
  programUrl: string;
  steps: readonly string[];
};

export const MARKETPLACES: readonly Marketplace[] = [
  {
    id: "mercado-livre",
    name: "Mercado Livre",
    brandUrl: "", // TODO: link global da Cat Dog no Mercado Livre
    programUrl: "https://www.mercadolivre.com.br/l/comece-a-recomendar",
    steps: [
      "Entre no Programa de Afiliados e Creators com a sua conta do Mercado Livre.",
      "Abra a página da Cat Dog e escolha o produto.",
      "Gere o link pela Barra de Afiliados ou pela Central de Afiliados e Criadores.",
      "Poste e acompanhe cliques e vendas na própria Central.",
    ],
  },
  {
    id: "shopee",
    name: "Shopee",
    brandUrl: "", // TODO: link global da Cat Dog na Shopee
    programUrl: "https://affiliate.shopee.com.br",
    steps: [
      "Cadastre-se no Programa de Afiliados da Shopee. A aprovação leva alguns dias úteis.",
      "Abra a página da Cat Dog e escolha o produto.",
      "Gere o link personalizado no painel de afiliado (site ou app).",
      "Use o sub_id com o nome do seu perfil para saber de onde veio cada venda.",
    ],
  },
];

export type Script = {
  id: string;
  theme: string;
  products: string;
  hook: string;
  script: readonly string[];
  caption: string;
};

export const SCRIPTS: readonly Script[] = [
  {
    id: "banho-em-casa",
    theme: "Banho em casa",
    products: "Shampoo 700 ml + Deo colônia 120 ml",
    hook: "Dá pra deixar o banho de casa com cheirinho de pet shop?",
    script: [
      "Mostre o pet antes do banho, de preferência fazendo bagunça.",
      "Aplique o shampoo e mostre a espuma de perto.",
      "Seque e finalize com a colônia: close no pet cheiroso.",
      "Feche mostrando os dois produtos e o link.",
    ],
    caption: "Banho de casa com cara de pet shop 🛁🐶 Usei shampoo e colônia Cat Dog. Link aqui embaixo. #publi",
  },
  {
    id: "dentes",
    theme: "Higiene bucal",
    products: "Creme dental + dedeira",
    hook: "Você escova os dentes do seu pet? Eu também não escovava.",
    script: [
      "Mostre os sabores do creme dental (morango, menta, chocolate, tutti frutti).",
      "Deixe o pet cheirar e lamber o creme primeiro.",
      "Escove com a dedeira, sem pressa, alguns segundos.",
      "Recompense o pet e mostre o kit no final.",
    ],
    caption: "Começamos a rotina de escovar os dentes 🦷 Creme dental Cat Dog com sabor que ele aceita. #publi",
  },
  {
    id: "filhote",
    theme: "Filhote em casa",
    products: "Educa Sim + Educa Não (casadinho)",
    hook: "Filhote fazendo xixi em todo lugar? Olha o que eu testei.",
    script: [
      "Mostre o tapete ou cantinho onde o filhote deve fazer as necessidades.",
      "Aplique o Educa Sim no lugar certo.",
      "Aplique o Educa Não no lugar onde ele insiste em fazer.",
      "Conte a evolução em poucos dias, sem prometer resultado.",
    ],
    caption: "Diário do filhote: dia 1 do treino com o casadinho Educa Sim + Não 🐾 #publi",
  },
  {
    id: "gato-catnip",
    theme: "Gatos",
    products: "Catnip + graminha para gato",
    hook: "A reação do meu gato quando abri isso aqui.",
    script: [
      "Grave o gato desconfiado antes de abrir o pacote.",
      "Ofereça o catnip e deixe a câmera rodando.",
      "Corte para a graminha pronta para ele mordiscar.",
      "Termine com o gato relaxado e o link.",
    ],
    caption: "Ele perdeu a pose 😹 Catnip e graminha Cat Dog. #publi",
  },
  {
    id: "banho-seco",
    theme: "Sem tempo para banho",
    products: "Banho seco 500 ml",
    hook: "Sem tempo pra dar banho hoje? Faz assim.",
    script: [
      "Mostre o pet depois do passeio ou da brincadeira.",
      "Aplique o banho seco e espalhe com a mão ou escova.",
      "Mostre o pelo depois e o pet feliz.",
    ],
    caption: "Pra semana corrida: banho seco Cat Dog 🐶 #publi",
  },
  {
    id: "profissional",
    theme: "Banho e tosa",
    products: "Shampoo 5 L + resfriador de lâminas",
    hook: "O que eu uso todo dia no banho e tosa.",
    script: [
      "Mostre a bancada com os galões de 5 litros.",
      "Banho em um cliente: diluição e espuma.",
      "Na tosa, aplique o resfriador na lâmina da máquina.",
      "Feche com o pet pronto e os produtos.",
    ],
    caption: "Bastidores do banho e tosa ✂️ Linha profissional Cat Dog. #publi",
  },
];

export const GOOD_PRACTICES = [
  {
    title: "Sinalize a publicidade",
    body: "Use #publi ou a marcação de parceria paga da rede. Post de afiliado é publicidade.",
  },
  {
    title: "Sem promessa de tratamento",
    body: "São produtos de higiene e beleza. Não diga que tratam, curam ou previnem doença.",
  },
  {
    title: "Fotos oficiais ou do seu pet",
    body: "Use as fotos desta página ou grave com o seu pet. Não use imagem de outro perfil.",
  },
  {
    title: "Link só do programa oficial",
    body: "A comissão só conta pelo link gerado no programa de afiliados do Mercado Livre ou da Shopee.",
  },
] as const;

export const FAQ = [
  {
    q: "Preciso me cadastrar com a My Pet?",
    a: "Não. Você só precisa estar no programa de afiliados do Mercado Livre ou da Shopee. Escolha o produto aqui, gere o link lá e poste.",
  },
  {
    q: "Quanto eu ganho por venda?",
    a: "A comissão é definida por cada marketplace, de acordo com a categoria do produto e as campanhas do momento. O valor atualizado aparece no seu painel de afiliado.",
  },
  {
    q: "Quem paga a comissão?",
    a: "O próprio marketplace, nas regras e prazos do programa de afiliados de cada um.",
  },
  {
    q: "Preciso de CNPJ ou de muitos seguidores?",
    a: "Isso depende das regras de cada programa. Os dois aceitam pessoa física; confira os requisitos na página oficial de cada um.",
  },
  {
    q: "Posso usar as fotos dos produtos?",
    a: "Pode. As fotos desta página são oficiais e liberadas para divulgação da Cat Dog.",
  },
] as const;
