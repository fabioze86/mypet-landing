import { getHubServiceClient } from "@mypet/core/supabase";

type Categoria = {
  slug: string;
  titulo: string;
  descricao: string;
  icone: string;
  ordem: number;
};

type Artigo = {
  categoriaSlug: string;
  slug: string;
  titulo: string;
  resumo: string;
  corpoMarkdown: string;
  palavrasChave: string;
  notaInterna?: string;
  ordem: number;
};

const CATEGORIAS: Categoria[] = [
  { slug: "primeiros-passos", titulo: "Primeiros passos", descricao: "Quem pode comprar e como começar a revender.", icone: "Flag", ordem: 0 },
  { slug: "cadastro", titulo: "Cadastro e acesso", descricao: "Criar o acesso à loja e ver os preços.", icone: "UserCircle", ordem: 1 },
  { slug: "catalogo", titulo: "Catálogo e produtos", descricao: "Catálogo, estoque, modelos e produtos esgotados.", icone: "Package", ordem: 2 },
  { slug: "precos", titulo: "Preços, mínimo e descontos", descricao: "Pedido mínimo, preço de atacado e desconto à vista.", icone: "Tag", ordem: 3 },
  { slug: "pedido", titulo: "Como fazer um pedido", descricao: "Pedir pelo site ou WhatsApp, incluir itens, usar crédito.", icone: "ShoppingCart", ordem: 4 },
  { slug: "pagamento", titulo: "Pagamento", descricao: "Pix, cartão em até 10x, boleto e comprovantes.", icone: "CreditCard", ordem: 5 },
  { slug: "entrega", titulo: "Frete e entrega", descricao: "Prazos por região, frete e rastreio.", icone: "Truck", ordem: 6 },
  { slug: "loja", titulo: "Show Room", descricao: "Compre direto do estoque e leve hoje. Mínimo de R$ 150.", icone: "Storefront", ordem: 7 },
  { slug: "trocas", titulo: "Trocas e problemas", descricao: "Item faltando, avaria, estorno e crédito.", icone: "ArrowsClockwise", ordem: 8 },
  { slug: "notas", titulo: "Notas fiscais", descricao: "Nota fiscal, XML e segunda via.", icone: "Receipt", ordem: 9 },
  { slug: "parcerias", titulo: "Parcerias", descricao: "Representação, grande volume, fornecedores.", icone: "Handshake", ordem: 10 },
];

const ARTIGOS: Artigo[] = [
  // Primeiros passos
  {
    categoriaSlug: "primeiros-passos", slug: "como-comprar", ordem: 0,
    titulo: "Como comprar da My Pet Brasil em 3 passos",
    resumo: "O caminho completo, do cadastro à entrega.",
    palavrasChave: "comecar comprar atacado revenda como funciona",
    corpoMarkdown: `A My Pet Brasil é uma distribuidora de produtos pet que vende no atacado para lojistas: pet shops, agropets, casas de ração, clínicas e lojas online. São cerca de 5 mil itens.

1. **Crie seu acesso** em [www.mypetbrasil.com](https://www.mypetbrasil.com) com CNPJ ou CPF e WhatsApp. É com esse acesso que os preços aparecem.
2. **Monte o pedido no carrinho.** Informe o CEP para ver o frete. O pedido mínimo é **R$ 250,00** na capital de São Paulo e **R$ 400,00** nas demais regiões — ou **R$ 150,00** comprando pessoalmente no [Show Room](/central-de-ajuda/a/showroom).
3. **Pague e acompanhe.** Pix com 5% de desconto, cartão em até 10x sem juros, depósito ou boleto. A separação e o despacho levam até 7 dias úteis.

> Dica: ficou alguma dúvida no meio do caminho? Fale com a gente pelo WhatsApp, no mesmo número em que você nos encontrou.`,
  },
  {
    categoriaSlug: "primeiros-passos", slug: "cpf-cnpj", ordem: 1,
    titulo: "Vocês vendem para CPF ou só para CNPJ?",
    resumo: "CPF e CNPJ, com o mesmo preço.",
    palavrasChave: "cpf cnpj pessoa fisica mei cnae sem cnpj",
    corpoMarkdown: `Atendemos **CPF e CNPJ, com o mesmo preço**. O documento serve apenas para identificar a sua loja no cadastro de acesso.

Você pode começar com CPF enquanto ainda está abrindo a empresa. Não pedimos CNAE específico.

A única diferença está no [boleto faturado](/central-de-ajuda/a/boleto-faturado), que exige CNPJ com mais de 2 anos e histórico de compras.`,
  },
  {
    categoriaSlug: "primeiros-passos", slug: "consumidor-final", ordem: 2,
    titulo: "Vocês vendem para consumidor final?",
    resumo: "Não. Nossos preços são somente de atacado, para lojistas.",
    palavrasChave: "consumidor final varejo comprar uma unidade para meu pet",
    corpoMarkdown: `Não. Nossos preços são somente de atacado e não atendemos consumidor final, nem no site nem no Show Room. Nossos produtos podem ser encontrados com nossos clientes lojistas, inclusive em marketplaces.`,
  },
  {
    categoriaSlug: "primeiros-passos", slug: "abrindo-loja", ordem: 3,
    titulo: "Estou abrindo minha loja. Por onde começo?",
    resumo: "Um roteiro para montar o primeiro estoque.",
    palavrasChave: "abrindo loja casa de racao primeiro estoque montar novo",
    notaInterna: "Confirmar que \"não é preciso comprar caixa fechada\" vale para a loja online.",
    corpoMarkdown: `1. **Crie o acesso com CPF** se o CNPJ ainda não saiu. Depois dá para atualizar o cadastro.
2. **Navegue pelo catálogo por categoria** (higiene, acessórios, camas, brinquedos, aves etc.) e monte o carrinho aos poucos. O carrinho funciona como orçamento: mostra total e frete.
3. **Planeje o primeiro pedido** a partir do mínimo de **R$ 250,00** (capital de SP) ou **R$ 400,00** (demais regiões). Não é preciso comprar caixa fechada de um único item.
4. **Pague à vista ou no cartão.** A primeira compra é sempre à vista (com 5% de desconto) ou no cartão, em até 10x sem juros.`,
  },

  // Cadastro
  {
    categoriaSlug: "cadastro", slug: "criar-acesso", ordem: 0,
    titulo: "Como criar meu acesso à loja",
    resumo: "CNPJ ou CPF e WhatsApp.",
    palavrasChave: "cadastro cadastrar criar conta acesso login",
    notaInterna: "Confirmar se o acesso é liberado na hora ou passa por aprovação manual, e qual é o link oficial de cadastro.",
    corpoMarkdown: `1. Acesse [www.mypetbrasil.com](https://www.mypetbrasil.com).
2. Clique em cadastrar e informe **CNPJ ou CPF** e o seu **WhatsApp**.
3. Com o acesso criado, você vê preços, estoque, frete e prazo de todos os itens.

O endereço do cadastro é o endereço de entrega. Confira antes de fazer o primeiro pedido.`,
  },
  {
    categoriaSlug: "cadastro", slug: "ver-precos", ordem: 1,
    titulo: "Por que não vejo os preços?",
    resumo: "Os preços aparecem depois de criar o acesso.",
    palavrasChave: "nao vejo precos valores ver preco tabela",
    corpoMarkdown: `Os preços ficam na loja e só aparecem **depois de criar o acesso** com CNPJ ou CPF e WhatsApp. Se você já tem acesso e não vê os preços, confira se está logado.

São cerca de 5 mil itens com preços que mudam diariamente. Por isso eles não ficam no catálogo público nem numa tabela em PDF.`,
  },
  {
    categoriaSlug: "cadastro", slug: "senha", ordem: 2,
    titulo: "Esqueci minha senha",
    resumo: "Como recuperar o acesso.",
    palavrasChave: "senha esqueci login entrar recuperar",
    notaInterna: "Sem regra oficial. Confirmar como a recuperação de senha funciona hoje na loja (e-mail ou WhatsApp).",
    corpoMarkdown: `Na tela de login, use a opção de recuperar senha. Se não receber a mensagem de recuperação, chame a gente no WhatsApp com o CNPJ ou CPF do cadastro e reenviamos o acesso.`,
  },
  {
    categoriaSlug: "cadastro", slug: "endereco", ordem: 3,
    titulo: "Como altero meu endereço de entrega?",
    resumo: "A entrega vai para o endereço do cadastro.",
    palavrasChave: "endereco alterar mudar entrega cadastro",
    notaInterna: "Confirmar o procedimento. Nas conversas, a logística pediu a um cliente que atualizasse o endereço na Receita Federal, e não só no cadastro.",
    corpoMarkdown: `A entrega é feita no endereço do cadastro. Para mudar, fale com a gente pelo WhatsApp **antes de fechar o pedido**. Depois que o pedido entra em separação, a troca de endereço pode atrasar a entrega.`,
  },

  // Catálogo
  {
    categoriaSlug: "catalogo", slug: "catalogo", ordem: 0,
    titulo: "Onde vejo o catálogo?",
    resumo: "Catálogo público completo, sem preço.",
    palavrasChave: "catalogo catalago pdf lista produtos",
    notaInterna: "Falta a URL oficial do catálogo público.",
    corpoMarkdown: `Temos um catálogo público completo, com marcas e categorias, sem preço. Ele fica em [www.mypetbrasil.com](https://www.mypetbrasil.com).

Preço, estoque e pedido ficam na loja, depois de [criar o acesso](/central-de-ajuda/a/criar-acesso).`,
  },
  {
    categoriaSlug: "catalogo", slug: "tabela-precos", ordem: 1,
    titulo: "Vocês têm tabela de preços em PDF?",
    resumo: "Não. Os preços ficam na loja.",
    palavrasChave: "tabela precos pdf planilha lista de precos jornal ofertas",
    corpoMarkdown: `Não enviamos tabela de preços em PDF ou planilha. Os preços mudam diariamente e ficam sempre atualizados na loja, depois de criar o acesso.

Para fazer um orçamento, é só adicionar os itens ao carrinho. Ele mostra o total e o frete para o seu CEP.`,
  },
  {
    categoriaSlug: "catalogo", slug: "tem-produto", ordem: 2,
    titulo: "Vocês têm tal produto? Como vejo o estoque?",
    resumo: "Busque na loja. O estoque aparece em cada item.",
    palavrasChave: "tem produto estoque disponivel tapete higienico areia racao pronta entrega",
    corpoMarkdown: `Use a busca da loja pelo nome, marca ou tipo de produto (ex.: "tapete higiênico", "areia", "comedouro"). Depois de logado, cada item mostra se está disponível.

Os itens estão sujeitos à disponibilidade no momento da separação. Se algum acabar, entramos em contato para oferecer uma substituição (outra cor, fragrância ou modelo parecido) ou um crédito no valor do item.`,
  },
  {
    categoriaSlug: "catalogo", slug: "esgotado", ordem: 3,
    titulo: "O produto esgotou. Vai voltar?",
    resumo: "Peça um similar pelo WhatsApp.",
    palavrasChave: "esgotado esgotou acabou volta indisponivel similar parecido",
    corpoMarkdown: `Itens indisponíveis costumam sair do site em breve. Se você precisa de algo parecido, mande o nome ou a foto do produto pelo WhatsApp que indicamos uma alternativa.`,
  },
  {
    categoriaSlug: "catalogo", slug: "personalizacao", ordem: 4,
    titulo: "Vocês fazem personalização ou marca própria?",
    resumo: "Não. Não fazemos personalização, definitivamente.",
    palavrasChave: "personalizacao marca propria logo estampa brinde gravacao",
    corpoMarkdown: `Não. Não fazemos personalização, marca própria, gravação de logo, estampa nem confecção de brindes, em nenhuma quantidade.

Todos os produtos são vendidos na versão padrão do catálogo.`,
  },

  // Preços
  {
    categoriaSlug: "precos", slug: "pedido-minimo", ordem: 0,
    titulo: "Qual é o pedido mínimo?",
    resumo: "R$ 250 na capital de SP · R$ 400 nas demais regiões.",
    palavrasChave: "pedido minimo valor minimo quantidade minima minimo",
    notaInterna: "O FAQ que está hoje no agente do WhatsApp (hub-clientes) ainda diz R$ 400 para todo o Brasil — não relacionado a esta central (Fase 2 decide a sincronia).",
    corpoMarkdown: `| Região de entrega | Pedido mínimo |
| --- | --- |
| Capital de São Paulo | **R$ 250,00** |
| Interior de SP e demais estados | **R$ 400,00** |

Comprando pessoalmente no [Show Room](/central-de-ajuda/a/showroom), o pedido mínimo é de apenas **R$ 150,00**.

O mínimo vale para o pedido todo. Você pode misturar produtos, sem precisar comprar caixa fechada de um único item.`,
  },
  {
    categoriaSlug: "precos", slug: "preco-atacado", ordem: 1,
    titulo: "O preço do site é de atacado?",
    resumo: "Sim. Nossos preços são somente de atacado.",
    palavrasChave: "preco atacado revenda lojista tabela diferenciada preco site mesmo loja varejo",
    corpoMarkdown: `Sim. **Nossos preços são somente de atacado**, feitos para lojistas. Não existe tabela de varejo e não atendemos consumidor final.

O preço que aparece na loja, depois do acesso liberado, já é o seu preço de lojista. Não há tabela separada para pedir.

Cotação de grande volume de um mesmo item é tratada pelo [Balcão de Negócios](/central-de-ajuda/a/grande-volume).`,
  },
  {
    categoriaSlug: "precos", slug: "desconto-quantidade", ordem: 2,
    titulo: "Tem desconto por quantidade?",
    resumo: "Alguns itens têm desconto automático no carrinho.",
    palavrasChave: "desconto quantidade comprando mais condicoes melhores negociacao",
    notaInterna: "Confirmar se o \"desconto automático por quantidade\" existe hoje na loja.",
    corpoMarkdown: `Alguns itens têm desconto automático por quantidade, que aparece direto no carrinho quando você aumenta o volume.

Para grande volume de um mesmo item (centenas ou milhares de unidades), fale com o [Balcão de Negócios](/central-de-ajuda/a/grande-volume).`,
  },
  {
    categoriaSlug: "precos", slug: "desconto-avista", ordem: 3,
    titulo: "Tem desconto no Pix ou à vista?",
    resumo: "5% de desconto nas compras à vista.",
    palavrasChave: "desconto pix a vista avista boleto",
    corpoMarkdown: `Sim. Nas compras à vista (Pix, depósito, transferência ou boleto à vista) há **5% de desconto**.

Comprando no [Show Room](/central-de-ajuda/a/showroom), o pagamento em dinheiro tem desconto extra.`,
  },
  {
    categoriaSlug: "precos", slug: "orcamento", ordem: 4,
    titulo: "Como faço um orçamento?",
    resumo: "O carrinho da loja é o orçamento.",
    palavrasChave: "orcamento cotacao quanto fica total",
    corpoMarkdown: `Adicione os itens ao carrinho e informe o CEP. O carrinho mostra o total, os descontos e o frete, sem compromisso de compra.

Prefere ajuda? Mande a lista de produtos pelo WhatsApp que um vendedor monta o orçamento para você.`,
  },

  // Pedido
  {
    categoriaSlug: "pedido", slug: "pedido-site", ordem: 0,
    titulo: "Como fazer um pedido pelo site",
    resumo: "Passo a passo do carrinho ao pagamento.",
    palavrasChave: "pedido site carrinho finalizar comprar",
    corpoMarkdown: `1. Entre com seu acesso em [www.mypetbrasil.com](https://www.mypetbrasil.com).
2. Adicione os produtos ao carrinho e informe o CEP para calcular o frete.
3. Confira se o total atingiu o [pedido mínimo](/central-de-ajuda/a/pedido-minimo).
4. Escolha a forma de pagamento e finalize.
5. Pagou no Pix? Envie o comprovante pelo WhatsApp para o pedido seguir mais rápido para a separação.`,
  },
  {
    categoriaSlug: "pedido", slug: "pedido-whatsapp", ordem: 1,
    titulo: "Posso fazer o pedido pelo WhatsApp?",
    resumo: "Sim, um vendedor monta o pedido para você.",
    palavrasChave: "whatsapp pedido por aqui vendedor site manutencao fora do ar",
    corpoMarkdown: `Sim. Mande a lista de produtos e quantidades que um vendedor monta o pedido. Os preços são os mesmos da loja.

Se o site estiver em manutenção, o pedido pelo WhatsApp é o caminho mais rápido.`,
  },
  {
    categoriaSlug: "pedido", slug: "incluir-item", ordem: 2,
    titulo: "Esqueci um item. Posso incluir no pedido?",
    resumo: "Sim, se o pedido ainda não foi separado.",
    palavrasChave: "incluir item adicionar ao pedido esqueci kit juntar",
    notaInterna: "Sem regra oficial. Uma cliente ficou dias sem conseguir incluir um kit no pedido — definir o procedimento e o responsável.",
    corpoMarkdown: `Chame a gente no WhatsApp com o **número do pedido** e os itens que quer incluir. Se o pedido ainda não entrou em separação, conseguimos juntar tudo num envio só.

Se já estiver separado, os itens novos seguem num novo pedido.`,
  },
  {
    categoriaSlug: "pedido", slug: "credito", ordem: 3,
    titulo: "Como uso meu crédito no site?",
    resumo: "Créditos de faltas valem para a próxima compra.",
    palavrasChave: "credito usar saldo cupom",
    notaInterna: "Explicar como o crédito aparece e é aplicado no checkout.",
    corpoMarkdown: `Quando falta algum item no seu pedido, o financeiro gera um crédito no valor da falta para você usar na próxima compra pelo site.`,
  },
  {
    categoriaSlug: "pedido", slug: "cancelar", ordem: 4,
    titulo: "Posso cancelar um pedido?",
    resumo: "Fale com a gente antes do despacho.",
    palavrasChave: "cancelar cancelamento desistir",
    notaInterna: "Sem política oficial de cancelamento. Definir prazo e condições.",
    corpoMarkdown: `Chame no WhatsApp com o número do pedido o quanto antes. Antes do despacho, o cancelamento é mais simples e o valor pago é estornado.`,
  },

  // Pagamento
  {
    categoriaSlug: "pagamento", slug: "formas-pagamento", ordem: 0,
    titulo: "Quais são as formas de pagamento?",
    resumo: "Cartão, Pix, depósito, boleto à vista e faturado.",
    palavrasChave: "forma de pagamento pix cartao boleto deposito transferencia",
    corpoMarkdown: `- **Cartão de crédito:** até 10x sem juros, parcela mínima de R$ 300,00.
- **Pix, depósito ou transferência:** 5% de desconto.
- **Boleto à vista:** 5% de desconto.
- **Boleto faturado:** para clientes aprovados pelo financeiro ([veja as regras](/central-de-ajuda/a/boleto-faturado)).

A primeira compra é sempre à vista ou no cartão de crédito.`,
  },
  {
    categoriaSlug: "pagamento", slug: "parcelamento", ordem: 1,
    titulo: "Em quantas vezes posso parcelar?",
    resumo: "Até 10x sem juros, parcela mínima de R$ 300.",
    palavrasChave: "parcelar parcelamento vezes sem juros cartao",
    corpoMarkdown: `Parcelamos em **até 10x sem juros** no cartão, com parcela mínima de **R$ 300,00**. Sujeito à aprovação da administradora do cartão.

| Valor do pedido | Parcelas sem juros |
| --- | --- |
| R$ 400,00 | 1x |
| R$ 900,00 | até 3x de R$ 300,00 |
| R$ 1.800,00 | até 6x de R$ 300,00 |
| R$ 3.000,00 ou mais | até 10x |`,
  },
  {
    categoriaSlug: "pagamento", slug: "boleto-faturado", ordem: 2,
    titulo: "Como funciona o boleto faturado?",
    resumo: "Para clientes com histórico e CNPJ com mais de 2 anos.",
    palavrasChave: "boleto faturado prazo credito analise",
    corpoMarkdown: `O boleto faturado é liberado apenas para clientes que tenham:

- histórico de compras com a My Pet Brasil;
- CNPJ com mais de 2 anos;
- nenhuma pendência financeira.

O pedido passa por análise do financeiro. O prazo de pagamento conta a partir do **despacho** do pedido, e não da data em que você fez o pedido.

Até a liberação, o pedido sai em Pix, cartão ou boleto à vista.`,
  },
  {
    categoriaSlug: "pagamento", slug: "pix-comprovante", ordem: 3,
    titulo: "Paguei no Pix e o pedido continua \"aguardando pagamento\"",
    resumo: "Envie o comprovante pelo WhatsApp.",
    palavrasChave: "pix comprovante aguardando pagamento paguei nao caiu confirmar",
    corpoMarkdown: `Envie o **comprovante do Pix** pelo WhatsApp com o número do pedido. Assim que o financeiro confirmar, o pedido segue para a separação.

> Dica: mande o comprovante logo depois de pagar. Com ele, o pedido vai para a separação sem esperar a baixa automática.`,
  },
  {
    categoriaSlug: "pagamento", slug: "cartao-recusado", ordem: 4,
    titulo: "O pagamento no cartão não foi concluído",
    resumo: "Nenhum valor é cobrado. Enviamos um link seguro.",
    palavrasChave: "cartao recusado nao passou erro pagamento link",
    corpoMarkdown: `Se a transação não for concluída no site, **nenhum valor é cobrado** e não há risco de cobrança em dobro. Nesse caso, enviamos pelo WhatsApp um link seguro de pagamento para você concluir o pedido.`,
  },

  // Entrega
  {
    categoriaSlug: "entrega", slug: "prazo", ordem: 0,
    titulo: "Qual é o prazo de entrega?",
    resumo: "Até 7 dias úteis para despachar, mais o transporte.",
    palavrasChave: "prazo entrega quanto tempo chega dias previsao demora",
    corpoMarkdown: `A separação e o despacho levam **até 7 dias úteis**. Depois do despacho, o transporte leva em média:

| Região | Transporte após o despacho |
| --- | --- |
| Sul e Sudeste | 3 a 7 dias úteis |
| Nordeste e Centro-Oeste | 5 a 16 dias úteis |
| Norte | 7 a 20 dias úteis |

Todos os prazos são **estimados** e variam de cidade para cidade.`,
  },
  {
    categoriaSlug: "entrega", slug: "frete", ordem: 1,
    titulo: "Vocês entregam em todo o Brasil? Como é o frete?",
    resumo: "Sim, por transportadora. O frete aparece no carrinho.",
    palavrasChave: "frete entrega todo brasil transportadora calcular gratis",
    corpoMarkdown: `Sim. O frete é por transportadora, para todo o Brasil. Ele é calculado pelo valor do pedido e pelo CEP e aparece no carrinho assim que você informa o CEP.

Algumas cidades têm frete grátis.`,
  },
  {
    categoriaSlug: "entrega", slug: "rastreio", ordem: 2,
    titulo: "Como rastreio meu pedido?",
    resumo: "Pelo código de rastreio ou pedindo a previsão no WhatsApp.",
    palavrasChave: "rastreio rastrear codigo onde esta pedido chegou enviado",
    corpoMarkdown: `Quando o pedido vai pelos Correios, enviamos o código de rastreio para você acompanhar no site dos Correios.

Quando a entrega é feita pelo caminhão da empresa ou por transportadora sem rastreio, peça a previsão de entrega pelo WhatsApp com o número do pedido.`,
  },
  {
    categoriaSlug: "entrega", slug: "regras-entrega", ordem: 3,
    titulo: "Regras de entrega",
    resumo: "Horário, endereço e taxa estadual.",
    palavrasChave: "horario entrega endereco dae taxa estadual",
    corpoMarkdown: `- A entrega é feita no **endereço do cadastro**, das **7h às 18h**.
- Em alguns estados há taxa estadual (DAE), paga pelo cliente.
- Os itens estão sujeitos à disponibilidade de estoque no momento da separação.`,
  },
  {
    categoriaSlug: "entrega", slug: "urgente", ordem: 4,
    titulo: "Preciso receber com urgência",
    resumo: "Avise antes de fechar o pedido.",
    palavrasChave: "urgente urgencia inauguracao amanha rapido",
    corpoMarkdown: `Como os prazos são estimados, não conseguimos garantir uma data. Se precisa receber até um dia específico (uma inauguração, por exemplo), avise pelo WhatsApp **antes de fechar o pedido** para verificarmos o que é possível.`,
  },

  // Show Room
  {
    categoriaSlug: "loja", slug: "showroom", ordem: 0,
    titulo: "O que é o Show Room da My Pet Brasil?",
    resumo: "Compre direto do estoque. Leve hoje.",
    palavrasChave: "showroom show room loja fisica comprar pessoalmente pronta entrega levar hoje",
    notaInterna: "O número \"3 mil\" veio entre colchetes no texto original do dono. Confirmar se é o valor final.",
    corpoMarkdown: `O Show Room da My Pet Brasil é o atacado pet feito para lojista: **mais de 3 mil itens a pronta entrega**, linha própria direto de fábrica e consultores que entendem de pet shop. Você escolhe, paga e sai com o carro carregado.

### Por que lojista vem até aqui

- **Preço de fábrica na prateleira.** Nossa linha própria sai direto da fábrica, sem intermediário. Sua margem agradece.
- **Pegou, pagou, levou.** Reposição no mesmo dia, sem esperar frete nem prazo de entrega.
- **Estacionamento gratuito.** Chega, estaciona, carrega. Sem rodar quarteirão atrás de vaga.
- **Veja de perto antes de comprar.** Tamanho, acabamento, embalagem: o que a foto de catálogo não mostra.
- **Desconto extra no dinheiro.** E pedido mínimo de apenas **R$ 150,00**.
- **Consultor ao seu lado.** Ajudamos você a montar o mix, escolher equipamentos e não gastar com o que não gira.`,
  },
  {
    categoriaSlug: "loja", slug: "endereco-horario", ordem: 1,
    titulo: "Onde fica o Show Room e qual o horário?",
    resumo: "Sacomã, São Paulo · estacionamento gratuito.",
    palavrasChave: "endereco loja fisica showroom horario onde fica sabado abre estacionamento",
    notaInterna: "Confirmar o horário do Show Room (o de 8h às 17h é o do atendimento) e se abre aos sábados, pergunta recorrente no WhatsApp.",
    corpoMarkdown: `**Rua Alencar Araripe, 212 — Sacomã, São Paulo/SP**

Atendimento de segunda a sexta, das 8h às 17h. Estacionamento gratuito para clientes.`,
  },
  {
    categoriaSlug: "loja", slug: "showroom-condicoes", ordem: 2,
    titulo: "Pedido mínimo e pagamento no Show Room",
    resumo: "Mínimo de R$ 150 e desconto extra no dinheiro.",
    palavrasChave: "showroom pedido minimo 150 dinheiro desconto pagamento loja",
    notaInterna: "Informar o percentual do desconto extra no dinheiro e quais formas de pagamento o Show Room aceita.",
    corpoMarkdown: `- **Pedido mínimo:** R$ 150,00, bem abaixo do mínimo das compras online.
- **Desconto extra no dinheiro**, além das condições de pagamento à vista.
- Você paga no balcão e leva a mercadoria na hora.`,
  },
  {
    categoriaSlug: "loja", slug: "retirada", ordem: 3,
    titulo: "Posso retirar no Show Room um pedido feito no site?",
    resumo: "Combine a retirada pelo WhatsApp.",
    palavrasChave: "retirar retirada buscar pegar pessoalmente pedido site",
    notaInterna: "Confirmar se pedidos do site podem ser retirados e se o frete sai do total.",
    corpoMarkdown: `Combine a retirada pelo WhatsApp com o número do pedido. Avisamos quando ele estiver separado.`,
  },

  // Trocas
  {
    categoriaSlug: "trocas", slug: "faltou-item", ordem: 0,
    titulo: "Faltou um item no meu pedido",
    resumo: "Crédito para a próxima compra ou estorno.",
    palavrasChave: "faltou falta faltando item pecas incompleto",
    corpoMarkdown: `Mande pelo WhatsApp o número do pedido e o item que faltou. Você escolhe entre:

- **Crédito** no valor da falta, para usar na próxima compra pelo site; ou
- **Estorno** do valor pago pelo item.`,
  },
  {
    categoriaSlug: "trocas", slug: "avaria", ordem: 1,
    titulo: "O produto chegou quebrado ou com defeito",
    resumo: "Mande fotos e o número do pedido.",
    palavrasChave: "quebrado avaria defeito danificado estragado",
    notaInterna: "Sem política oficial. Definir o prazo para reclamar após o recebimento e quem paga o frete de volta.",
    corpoMarkdown: `Envie pelo WhatsApp o número do pedido, fotos do produto e da embalagem e uma breve descrição do problema. Analisamos e oferecemos reposição, crédito ou estorno.`,
  },
  {
    categoriaSlug: "trocas", slug: "estorno", ordem: 2,
    titulo: "Quanto tempo leva o estorno?",
    resumo: "Até 3 dias úteis depois de processado.",
    palavrasChave: "estorno reembolso devolucao dinheiro devolver valor",
    corpoMarkdown: `Depois que o estorno é processado, o valor leva até **3 dias úteis** para aparecer. No cartão de crédito, o prazo também depende da administradora e pode aparecer só na fatura seguinte.

Enviamos o comprovante do estorno pelo WhatsApp. Se o valor não constar no extrato, apresente o comprovante ao seu banco.`,
  },
  {
    categoriaSlug: "trocas", slug: "trocar-item", ordem: 3,
    titulo: "Posso trocar um produto?",
    resumo: "Fale com a gente pelo WhatsApp.",
    palavrasChave: "trocar troca devolver item",
    notaInterna: "Sem política oficial de troca por arrependimento ou por erro do cliente. Definir.",
    corpoMarkdown: `Chame pelo WhatsApp com o número do pedido e o item que quer trocar. Avaliamos caso a caso.`,
  },
  {
    categoriaSlug: "trocas", slug: "amazon", ordem: 4,
    titulo: "Comprei na Amazon e tive um problema",
    resumo: "Confira quem vendeu o produto.",
    palavrasChave: "amazon marketplace mercado livre comprei quebrado",
    corpoMarkdown: `Existe uma marca "My Pet Brasil" vinculada indevidamente a produtos de terceiros na Amazon. Confira quem aparece em **"Vendido e enviado por"** e abra o chamado com esse vendedor ou com a própria Amazon.

Já solicitamos a remoção dessa vinculação.`,
  },

  // Notas
  {
    categoriaSlug: "notas", slug: "nota-fiscal", ordem: 0,
    titulo: "Recebo nota fiscal?",
    resumo: "Sim, todo pedido sai com NF-e.",
    palavrasChave: "nota fiscal nf nfe",
    notaInterna: "Confirmar como a NF chega ao cliente (junto da mercadoria, por e-mail ou pelos dois).",
    corpoMarkdown: `Sim. Todo pedido é faturado com nota fiscal eletrônica (NF-e), emitida no CNPJ ou CPF do cadastro.`,
  },
  {
    categoriaSlug: "notas", slug: "xml", ordem: 1,
    titulo: "Como peço o XML ou a segunda via da nota?",
    resumo: "Pelo WhatsApp, com o número do pedido.",
    palavrasChave: "xml segunda via danfe nota codigo de barras",
    notaInterna: "Confirmar o canal e o prazo. Definir se \"nota com código de barras dos produtos\" é algo que se atende.",
    corpoMarkdown: `Peça pelo WhatsApp com o número do pedido e enviamos o XML e o DANFE (a versão em PDF da nota).`,
  },

  // Parcerias
  {
    categoriaSlug: "parcerias", slug: "representante", ordem: 0,
    titulo: "Quero ser representante comercial",
    resumo: "Envie sua apresentação.",
    palavrasChave: "representante representacao vender seus produtos regiao",
    notaInterna: "Sem regra oficial. Confirmar se vocês trabalham com representantes e qual o canal.",
    corpoMarkdown: `Mande pelo WhatsApp sua região de atuação e as linhas que você já representa. Nosso time comercial avalia e retorna.`,
  },
  {
    categoriaSlug: "parcerias", slug: "dropshipping", ordem: 1,
    titulo: "Vocês fazem dropshipping?",
    resumo: "Não fazemos dropshipping nem cross docking.",
    palavrasChave: "dropshipping dropship cross docking enviar direto meu cliente",
    corpoMarkdown: `Não trabalhamos com dropshipping nem com cross docking. O lojista compra o estoque e revende.`,
  },
  {
    categoriaSlug: "parcerias", slug: "grande-volume", ordem: 2,
    titulo: "Grande volume ou venda em marketplace",
    resumo: "Fale com o Balcão de Negócios.",
    palavrasChave: "grande volume marketplace mercado livre mil unidades cotacao balcao",
    notaInterna: "Falta a URL do formulário do Balcão de Negócios.",
    corpoMarkdown: `Cotação de grande volume de um mesmo item ou operação de marketplace é tratada pelo **Balcão de Negócios**, que tem formulário próprio.`,
  },
  {
    categoriaSlug: "parcerias", slug: "fornecedor", ordem: 3,
    titulo: "Sou fornecedor e quero apresentar meus produtos",
    resumo: "Use o canal de compras.",
    palavrasChave: "fornecedor fabricante apresentar produtos compras setor de compras",
    notaInterna: "Definir um e-mail ou formulário de compras. Fornecedores geraram cerca de 25 conversas no mês pelo WhatsApp de vendas.",
    corpoMarkdown: `Este WhatsApp é dedicado ao atendimento de lojistas. Para apresentar produtos ao nosso setor de compras, envie seu catálogo pelo canal indicado abaixo.`,
  },
];

async function seed() {
  const supabase = getHubServiceClient();

  const categoriaIdPorSlug = new Map<string, string>();
  for (const categoria of CATEGORIAS) {
    const { data, error } = await supabase
      .from("categorias_ajuda")
      .upsert(
        {
          slug: categoria.slug,
          titulo: categoria.titulo,
          descricao: categoria.descricao,
          icone: categoria.icone,
          ordem: categoria.ordem,
          atualizado_por: "seed-2026-09-23",
        },
        { onConflict: "slug" },
      )
      .select("id, slug")
      .single();
    if (error || !data) {
      throw new Error(`Falha ao inserir categoria ${categoria.slug}: ${error?.message}`);
    }
    categoriaIdPorSlug.set(data.slug, data.id);
    console.log(`categoria: ${categoria.slug}`);
  }

  for (const artigo of ARTIGOS) {
    const categoriaId = categoriaIdPorSlug.get(artigo.categoriaSlug);
    if (!categoriaId) {
      throw new Error(`Categoria não encontrada para o artigo ${artigo.slug}: ${artigo.categoriaSlug}`);
    }
    const { error } = await supabase.from("artigos_ajuda").upsert(
      {
        categoria_id: categoriaId,
        slug: artigo.slug,
        titulo: artigo.titulo,
        resumo: artigo.resumo,
        corpo_markdown: artigo.corpoMarkdown,
        palavras_chave: artigo.palavrasChave,
        nota_interna: artigo.notaInterna ?? null,
        status: "rascunho",
        ordem: artigo.ordem,
        atualizado_por: "seed-2026-09-23",
      },
      { onConflict: "slug" },
    );
    if (error) {
      throw new Error(`Falha ao inserir artigo ${artigo.slug}: ${error.message}`);
    }
    console.log(`artigo: ${artigo.slug} (rascunho)`);
  }

  console.log(`\n${CATEGORIAS.length} categorias e ${ARTIGOS.length} artigos semeados, todos em rascunho.`);
}

seed().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
