// Conteúdo da landing pública (pré-acesso) do canal mypetbrasil.
//
// Posicionamento: este site é a "Tabela de Preços My Pet Brasil", uma extensão
// do e-commerce www.mypetbrasil.com — mesmos produtos, mesmos preços. O cliente
// consulta, monta o pedido aqui e o pedido é enviado pelo WhatsApp.
// Na copy, NÃO usar "atacado" (sugere preço diferente do site), "cotação"
// (soa sem compromisso) nem "loja" para se referir a este site.
//
// As "Condições comerciais" e o FAQ abaixo espelham o que estava publicado na
// Central de Ajuda de produção (mypetbrasil.zendesk.com, extração de 2026-08-23):
// pedido mínimo, formas de pagamento, prazos de entrega/frete, regra de CNPJ
// e dropshipping. Ao mudar a regra comercial na central, atualize aqui.
//
// O que aparece aqui são REGRAS comerciais públicas (pedido mínimo, parcelamento),
// não preço de item. Preço e pedido ficam só na tabela (/pedido-rapido, protegida
// por cadastro); nada de valor de produto nesta página.

export const OFFICIAL_SITE_URL = "https://www.mypetbrasil.com";

export const commercialConditions = [
  {
    id: "pedido-minimo",
    icon: "CurrencyCircleDollar",
    title: "Pedido mínimo",
    value: "R$ 250 na capital de SP · R$ 400 nos demais estados",
    detail:
      "Valor mínimo para compra e entrega: R$ 250,00 na capital de São Paulo; R$ 400,00 no interior de SP e nas outras regiões.",
  },
  {
    id: "pagamento",
    icon: "CreditCard",
    title: "Formas de pagamento",
    value: "Cartão em até 3x sem juros · 5% à vista",
    detail:
      "Cartão de crédito, Pix, depósito e boleto. O boleto faturado (a prazo) depende de análise do financeiro.",
  },
  {
    id: "entrega",
    icon: "Truck",
    title: "Entrega, frete e prazo",
    value: "3 a 7 dias úteis no Sul e Sudeste",
    detail:
      "Separação e despacho em até 7 dias úteis. O prazo por região conta a partir do despacho; o frete sai pelo valor do pedido e pelo CEP.",
  },
] as const;

export const quickAccessSteps = [
  {
    id: "cnpj-email",
    icon: "IdentificationCard",
    title: "Informe seu CNPJ",
    body: "Cadastro rápido para liberar a tabela.",
  },
  {
    id: "consulta",
    icon: "MagnifyingGlass",
    title: "Consulte os preços",
    body: "Pesquise pelo nome, SKU, categoria ou marca.",
  },
  {
    id: "pedido",
    icon: "ShoppingCart",
    title: "Envie seu pedido pelo WhatsApp",
    body: "Informe as quantidades e mande o pedido pronto para o nosso time.",
  },
] as const;

// "Mesma My Pet, mesmos preços": responde a dúvida "compro por qual site?".
export const whyBuyPoints = [
  {
    id: "mesmos-precos",
    icon: "CurrencyCircleDollar",
    heading: "Mesmos preços do site",
    body: "Os valores da tabela são os mesmos do mypetbrasil.com, atualizados todos os dias.",
  },
  {
    id: "mesmos-produtos",
    icon: "Stack",
    heading: "Mesmos produtos e estoque",
    body: "Quase 5 mil itens para cães, gatos, banho e tosa, higiene e acessórios.",
  },
  {
    id: "tudo-numa-tela",
    icon: "MagnifyingGlass",
    heading: "Todos os preços numa tela",
    body: "Busque por SKU, marca ou categoria e veja dezenas de itens de uma vez. Ideal para reposição.",
  },
  {
    id: "whatsapp",
    icon: "Headset",
    heading: "Pedido direto com o nosso time",
    body: "Você monta o pedido aqui e ele chega pronto no WhatsApp da My Pet, com atendimento de gente.",
  },
] as const;

export const steps = [
  {
    id: "cadastro",
    icon: "IdentificationCard",
    title: "Faça seu cadastro rápido",
    body: "Informe seu CNPJ e os dados básicos da sua empresa. Leva poucos minutos.",
  },
  {
    id: "acesso",
    icon: "LockKeyOpen",
    title: "Abra a tabela de preços",
    body: "O acesso é liberado na hora, com os mesmos preços do mypetbrasil.com.",
  },
  {
    id: "pedido",
    icon: "MagnifyingGlass",
    title: "Monte seu pedido",
    body: "Busque por produto, SKU, categoria ou marca, informe as quantidades e adicione os itens.",
  },
  {
    id: "compra",
    icon: "ShoppingCart",
    title: "Envie pelo WhatsApp",
    body: "Seu pedido chega pronto no WhatsApp da My Pet. Nosso time confirma estoque, frete e pagamento e fecha com você.",
  },
] as const;

// TODO: substituir por depoimentos reais de lojistas (texto + nome + cidade +
// loja). Os três abaixo são fictícios e existem só para o layout não quebrar.
export const testimonials = [
  {
    id: "t1",
    quote:
      "Comecei comprando pouco para testar o mix. Hoje faço pedido toda semana e a margem do balcão melhorou.",
    name: "Renata Alcântara",
    city: "Sorocaba, SP",
    store: "Pet Vida",
  },
  {
    id: "t2",
    quote:
      "O que pesou foi ver pedido mínimo e prazo antes de entrar. Cadastrei o CNPJ e já estava comprando no mesmo dia.",
    name: "Marcos Beltrão",
    city: "Contagem, MG",
    store: "Mundo Animal Contagem",
  },
  {
    id: "t3",
    quote:
      "Recebo dentro do prazo combinado e o frete fecha certo pelo CEP. Parou de ser aposta.",
    name: "Juliana Prates",
    city: "Londrina, PR",
    store: "Casa do Bicho",
  },
] as const;

export const commercialFaq = [
  {
    q: "Preciso de CNPJ para comprar?",
    a: "A tabela é para quem revende: pet shops, banho e tosa, clínicas veterinárias, agropecuárias e distribuidores. Se você ainda está abrindo o negócio ou pesquisando o mercado pet, pode criar o acesso com CPF para conhecer os preços, que são os mesmos. Mas atenção: a My Pet não vende para consumidor final, todo pedido é para revenda.",
  },
  {
    q: "A My Pet vende para consumidor final?",
    a: "Não. O atendimento é exclusivo para quem revende: pet shops, clínicas veterinárias, agropecuárias e distribuidores. O consumidor final encontra os produtos com nossos clientes, inclusive em marketplaces.",
  },
  {
    q: "Como eu vejo os preços?",
    a: "Os preços aparecem na tabela, liberada assim que você faz o cadastro com CNPJ e WhatsApp. São quase 5 mil itens e os valores podem mudar diariamente, por isso não ficam no catálogo público.",
  },
  {
    q: "Os preços da tabela são os mesmos do site mypetbrasil.com?",
    a: "Sim. Tabela e site usam a mesma base de preços, produtos e estoque da My Pet Brasil. A tabela é só outro jeito de consultar: tudo numa tela, com busca por SKU, marca e categoria, para montar o pedido mais rápido.",
  },
  {
    q: "Como eu fecho o pedido?",
    a: "Monte o pedido na tabela e toque em \"Enviar pedido pelo WhatsApp\". A lista chega pronta para o nosso time, que confirma estoque, frete e forma de pagamento e fecha o pedido com você por lá.",
  },
  {
    q: "Qual é o pedido mínimo?",
    a: "R$ 250,00 para compra e entrega na capital de São Paulo. R$ 400,00 para o interior de SP e para os demais estados. O total do seu pedido aparece na tabela enquanto você monta.",
  },
  {
    q: "Quais são as formas de pagamento?",
    a: "Cartão de crédito, Pix, depósito/transferência, boleto à vista e boleto faturado (a prazo, sujeito a análise). No pagamento à vista há 5% de desconto.",
  },
  {
    q: "Como funciona o parcelamento no cartão?",
    a: "Até R$ 399,99 em 1x; de R$ 400,00 a R$ 799,99 em 2x sem juros; acima de R$ 800,00 em 3x sem juros. Acima de R$ 1.000,00 em 4x, de R$ 1.200,00 em 5x e de R$ 1.500,00 em 6x, com juros de 1,99% ao mês. Sujeito à aprovação da administradora do cartão.",
  },
  {
    q: "Consigo comprar no boleto faturado?",
    a: "O boleto faturado é liberado só para clientes com histórico de compras na My Pet, CNPJ com mais de 2 anos e sem pendências, após análise do departamento financeiro. O prazo de pagamento conta a partir do despacho da mercadoria. Até lá, o pedido sai no Pix, cartão ou boleto à vista.",
  },
  {
    q: "Qual é o prazo de entrega?",
    a: "Primeiro vem a separação e o despacho, que levam até 7 dias úteis. A partir do despacho, o prazo estimado é: Sul e Sudeste de 3 a 7 dias úteis; Nordeste e Centro-Oeste de 5 a 16 dias úteis; Norte de 7 a 20 dias úteis. São estimativas e variam de cidade para cidade.",
  },
  {
    q: "Como funciona o frete e quais regiões são atendidas?",
    a: "Enviamos para todo o Brasil por transportadora. O frete é calculado pelo valor do pedido e pelo destino, e algumas cidades têm frete grátis. Nosso time informa o valor pelo WhatsApp ao confirmar o pedido.",
  },
  {
    q: "A My Pet trabalha com dropshipping?",
    a: "Não. A My Pet não faz dropshipping nem cross docking. Você compra o estoque e revende para os seus clientes.",
  },
  {
    q: "Há outras regras de entrega que eu devo saber?",
    a: "A entrega é feita no mesmo endereço do CNPJ do cadastro, dentro do horário comercial (7h às 18h). Avise se a sua loja tem restrição. Em alguns estados a entrega gera taxa estadual (DAE), paga pelo cliente. Todos os itens dependem de disponibilidade em estoque no momento da separação.",
  },
  {
    q: "Posso ver o catálogo antes de criar o acesso?",
    a: "Pode. As marcas e categorias ficam nesta página e há um catálogo completo de produtos sem preço. Os preços ficam na tabela, liberada assim que você faz o cadastro.",
  },
] as const;

export const institutionalPoints = [
  { id: "cnpj", label: "Operação com CNPJ ativo no ramo de distribuição pet." },
  { id: "catalogo", label: "Catálogo com marcas e categorias listadas nesta página." },
  { id: "suporte", label: "Suporte por WhatsApp após o acesso, para dúvidas de pedido." },
] as const;
