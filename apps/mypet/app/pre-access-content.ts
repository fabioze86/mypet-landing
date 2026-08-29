// Conteúdo da landing pública (pré-acesso). NÃO contém preço: preços vivem só
// em /loja (storefront protegido). Os valores comerciais abaixo são EXEMPLOS DE
// DESENVOLVIMENTO — cada um marcado com "// exemplo de desenvolvimento". Trocar
// pelos números reais antes de produção, sem alterar os componentes que os
// consomem, e sem introduzir valores em reais nesta página.

export const commercialConditions = [
  {
    id: "pedido-minimo",
    title: "Pedido mínimo",
    // exemplo de desenvolvimento — substituir pela regra real (ex.: nº de caixas)
    value: "Caixas fechadas por item",
    detail: "Exemplo de condição para o primeiro pedido. O valor mínimo aparece na loja.",
  },
  {
    id: "desconto-volume",
    title: "Desconto por volume",
    // exemplo de desenvolvimento — substituir pela faixa real de desconto
    value: "Faixas progressivas por quantidade",
    detail: "Exemplo de faixa progressiva conforme a quantidade comprada.",
  },
  {
    id: "entrega",
    title: "Entrega, frete e prazo",
    // exemplo de desenvolvimento — substituir pelo prazo real por região
    value: "Em até 5 dias úteis",
    detail: "Exemplo de prazo para regiões atendidas, após a confirmação do pedido.",
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
    q: "Qual é o pedido mínimo?",
    // exemplo de desenvolvimento — substituir pela regra real do pedido mínimo
    a: "Exemplo: definido por caixas fechadas; o mínimo aparece na loja.",
  },
  {
    q: "Há desconto para compras em maior quantidade?",
    a: "Exemplo: sim, com faixas progressivas conforme o volume do pedido.",
  },
  {
    q: "A My Pet vende para pessoa física?",
    a: "Não. A loja é exclusiva para CNPJ do ramo pet.",
  },
  {
    q: "Quais são as formas de pagamento?",
    // exemplo de desenvolvimento — substituir pelas formas de pagamento reais
    a: "Exemplo: boleto e Pix; prazo conforme análise cadastral.",
  },
  {
    q: "Como é calculado o frete e quais regiões são atendidas?",
    a: "Exemplo: por peso e destino, nas regiões atendidas pela distribuição.",
  },
  {
    q: "Qual é o prazo de entrega?",
    // exemplo de desenvolvimento — substituir pelo prazo real de entrega
    a: "Exemplo: até 5 dias úteis após a confirmação do pedido.",
  },
  {
    q: "Preciso de CNPJ para comprar?",
    a: "Sim. O CNPJ identifica sua loja no momento do acesso.",
  },
  {
    q: "Como acesso os preços?",
    a: "Crie o acesso com CNPJ e WhatsApp; os preços aparecem em /loja.",
  },
] as const;

export const institutionalPoints = [
  { id: "cnpj", label: "Operação com CNPJ ativo no ramo de distribuição pet." },
  { id: "catalogo", label: "Catálogo com marcas e categorias listadas nesta página." },
  { id: "suporte", label: "Suporte por WhatsApp após o acesso, para dúvidas de pedido." },
] as const;
