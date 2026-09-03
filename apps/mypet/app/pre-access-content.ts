// Conteúdo da landing pública (pré-acesso) do canal mypetbrasil.
//
// As "Condições comerciais" e o FAQ abaixo espelham o que estava publicado na
// Central de Ajuda de produção (mypetbrasil.zendesk.com, extração de 2026-08-23):
// pedido mínimo, formas de pagamento, prazos de entrega/frete, regra de CNPJ,
// atacado e dropshipping. Ao mudar a regra comercial na central, atualize aqui.
//
// O que aparece aqui são REGRAS comerciais públicas (pedido mínimo, parcelamento),
// não preço de item. Preço, estoque e carrinho continuam só em /loja (storefront
// protegido); nada de valor de produto/catálogo nesta página.

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

export const metrics = [
  { id: "itens", value: "~5 mil", label: "itens no catálogo, com preço de atacado" },
  { id: "categorias", value: "12+", label: "categorias em destaque nesta página" },
  { id: "cobertura", value: "Brasil", label: "entrega por transportadora para todas as regiões" },
  { id: "prazo", value: "3 a 7 dias", label: "úteis no Sul e Sudeste após o despacho" },
] as const;

export const steps = [
  {
    id: "cadastro",
    icon: "IdentificationCard",
    title: "Cadastro com CNPJ e WhatsApp",
    body: "Sem cotação por WhatsApp. Você preenche o formulário desta página.",
  },
  {
    id: "acesso",
    icon: "LockKeyOpen",
    title: "Acesso liberado na hora",
    body: "A loja com preço, estoque e carrinho abre assim que o cadastro é enviado.",
  },
  {
    id: "pedido",
    icon: "ShoppingCart",
    title: "Monta o pedido no carrinho",
    body: "Você escolhe os itens e fecha o pedido sozinho, no seu tempo.",
  },
  {
    id: "entrega",
    icon: "Package",
    title: "Recebe no endereço do CNPJ",
    body: "Entrega por transportadora no mesmo endereço do cadastro, em horário comercial.",
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
      "Recebo dentro do prazo que aparece na loja e o frete fecha certo pelo CEP. Parou de ser aposta.",
    name: "Juliana Prates",
    city: "Londrina, PR",
    store: "Casa do Bicho",
  },
] as const;

export const commercialFaq = [
  {
    q: "Preciso de CNPJ para comprar?",
    a: "A My Pet vende para lojistas e revendedores do ramo pet. Você pode criar o acesso com CNPJ ou com CPF; os preços são os mesmos. O documento identifica a sua loja quando você entra na loja.",
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
    a: "A entrega é feita no mesmo endereço do CNPJ do cadastro, dentro do horário comercial (7h às 18h). Avise se a sua loja tem restrição. Em alguns estados a entrega gera taxa estadual (DAE), paga pelo cliente. Todos os itens dependem de disponibilidade em estoque no momento da separação.",
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
