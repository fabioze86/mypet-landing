// Conteúdo da landing pública (pré-acesso) do canal mypetbrasil.
//
// As "Condições comerciais" e o FAQ abaixo espelham o que estava publicado na
// Central de Ajuda de produção (mypetbrasil.zendesk.com, extração de 2026-08-23):
// pedido mínimo, formas de pagamento, prazos de entrega/frete, regra de CNPJ,
// atacado e dropshipping. Ao mudar a regra comercial na central, atualize aqui.
//
// O que aparece aqui são REGRAS comerciais públicas (pedido mínimo, parcelamento),
// não preço de item. Preço, estoque e carrinho continuam só em /loja (storefront
// protegido) — nada de valor de produto/catálogo nesta página.

export const commercialConditions = [
  {
    id: "pedido-minimo",
    title: "Pedido mínimo",
    value: "R$ 250 na capital de SP · R$ 400 nos demais estados",
    detail:
      "Valor mínimo para compra e entrega: R$ 250,00 na capital de São Paulo; R$ 400,00 no interior de SP e nas outras regiões.",
  },
  {
    id: "pagamento",
    title: "Formas de pagamento",
    value: "Cartão em até 3x sem juros · 5% à vista",
    detail:
      "Cartão de crédito, Pix, depósito e boleto. O boleto faturado (a prazo) depende de análise do financeiro.",
  },
  {
    id: "entrega",
    title: "Entrega, frete e prazo",
    value: "3 a 7 dias úteis no Sul e Sudeste",
    detail:
      "Separação e despacho em até 7 dias úteis. O prazo por região conta a partir do despacho; o frete sai pelo valor do pedido e pelo CEP.",
  },
] as const;

export const educationCards = [
  {
    id: "como-comprar",
    title: "Como funciona a compra",
    body: "Cadastro, acesso à loja e pedido pelo carrinho.",
    href: "#condicoes",
  },
  {
    id: "condicoes",
    title: "Condições de compra",
    body: "Pedido mínimo, descontos e formas de pagamento.",
    href: "#condicoes",
  },
  {
    id: "categorias",
    title: "Categorias disponíveis",
    body: "Veja se o mix atende sua loja.",
    href: "#categorias",
  },
  {
    id: "entrega-pagamento",
    title: "Entrega e pagamento",
    body: "Prazos, regiões e meios de pagamento.",
    href: "#faq",
  },
] as const;

export const commercialFaq = [
  {
    q: "Preciso de CNPJ para comprar?",
    a: "A My Pet vende para lojistas e revendedores do ramo pet. Você pode criar o acesso com CNPJ ou com CPF — os preços são os mesmos. O documento identifica a sua loja quando você entra na loja.",
  },
  {
    q: "A My Pet vende para consumidor final?",
    a: "Não. O atendimento é exclusivo para quem revende: pet shops, clínicas veterinárias, agropecuárias e distribuidores. O consumidor final encontra os produtos com nossos clientes, inclusive em marketplaces.",
  },
  {
    q: "Como eu vejo os preços?",
    a: "Os preços aparecem só na loja, depois que você cria o acesso com CNPJ e WhatsApp. São quase 5 mil itens e os valores podem mudar diariamente, por isso não ficam no catálogo público. Já são preços de atacado, para lojista.",
  },
  {
    q: "Qual é o pedido mínimo?",
    a: "R$ 250,00 para compra e entrega na capital de São Paulo. R$ 400,00 para o interior de SP e para os demais estados. O total do seu carrinho aparece na loja.",
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
    a: "Enviamos para todo o Brasil por transportadora. O frete é calculado pelo valor do pedido e pelo destino, e algumas cidades têm frete grátis. O valor aparece no carrinho quando você informa o CEP de entrega.",
  },
  {
    q: "A My Pet trabalha com dropshipping?",
    a: "Não. A My Pet não faz dropshipping nem cross docking. Você compra o estoque e revende para os seus clientes.",
  },
  {
    q: "Há outras regras de entrega que eu devo saber?",
    a: "A entrega é feita no mesmo endereço do CNPJ do cadastro, dentro do horário comercial (7h às 18h) — avise se a sua loja tem restrição. Em alguns estados a entrega gera taxa estadual (DAE), paga pelo cliente. Todos os itens dependem de disponibilidade em estoque no momento da separação.",
  },
  {
    q: "Posso ver o catálogo antes de criar o acesso?",
    a: "Pode. As marcas e categorias ficam nesta página e há um catálogo completo de produtos sem preço. Preço, estoque e pedido ficam na loja, liberada assim que você cria o acesso.",
  },
] as const;

export const institutionalPoints = [
  { id: "cnpj", label: "Operação com CNPJ ativo no ramo de distribuição pet." },
  { id: "catalogo", label: "Catálogo com marcas e categorias listadas nesta página." },
  { id: "suporte", label: "Suporte por WhatsApp após o acesso, para dúvidas de pedido." },
] as const;
