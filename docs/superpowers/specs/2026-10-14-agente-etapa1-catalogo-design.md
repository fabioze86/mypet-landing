# Agente My Pet — Etapa 1: consulta ao catálogo do Hub

Data: 2026-10-14
Status: aprovado

## Contexto e visão

O assistente de dúvidas (`/api/duvidas`, caixa `FaqAssistant` na home do mypet) hoje responde só com o FAQ comercial e os artigos da Central de Ajuda. A visão é transformá-lo no agente central do canal, atendendo dois públicos:

- **Lead frio** (sem cadastro): tira dúvidas e conhece produtos, **sem ver preço**. O caminho de saída é sempre o cadastro (`/cadastro`, CNPJ + WhatsApp obrigatórios, e-mail opcional — já é assim hoje).
- **Cliente cadastrado**: compra com rapidez. O valor do agente está em **conveniência e rapidez**, não em negociação: ele nunca promete desconto nem preço melhor (os preços são os mesmos do mypetbrasil.com).

O trabalho foi dividido em etapas, cada uma com spec própria:

1. **Base: catálogo** — este documento.
2. **Painel e landing** — o agente vira a landing (cartões de intenção estilo Hostinger, recursos com cadeado, cadastro inline, layout dividido estilo Clara).
3. **Agente do cliente** — adicionar ao carrinho do `/pedido-rapido`, histórico, repetir pedido, cota por comprador e contato humano **só para cadastrados**.

Fora do roadmap: negociação de condições comerciais (decisão: não existem condições além da tabela). Aviso de promoção é disparo ativo, não conversa; se entrar, vira etapa própria.

## Objetivo da etapa 1

O agente passa a consultar produtos do catálogo do Hub (canal `mypetbrasil`). Visitante vê nome, marca e variação; comprador cadastrado vê também o preço e um link para a tabela.

## Decisões

- **Preço só para cadastrado.** Para visitante, o preço não entra no contexto do modelo (não aparece no resultado da ferramenta), então não há como vazar por engenharia de prompt.
- **Produtos em lista estruturada**, não no texto: o backend devolve os itens e a UI renderiza. O preço exibido vem do banco, nunca do texto do modelo.
- **Sem botão "falar com uma pessoa" para visitante**, nesta nem nas próximas etapas (na etapa 3 ele aparece só para cadastrados): lead frio direto no atendimento já é um problema hoje. Pelo mesmo motivo, removemos as menções a WhatsApp que hoje empurram o visitante para o time.
- **Abordagem:** ferramenta chamada pelo modelo (mesmo padrão do assistente do `/loja`), não busca prévia sem ferramenta — a busca do catálogo é `ilike %termo%` e não funciona com a frase inteira do visitante.

## Desenho

### 1. Servidor — `packages/core/src/support-assistant-server.ts`

- `SupportAssistantConfig` ganha bloco opcional:
  ```ts
  catalog?: { resolveIsBuyer: (req: NextRequest) => Promise<boolean> };
  ```
  Sem `catalog`, o handler se comporta exatamente como hoje (sem ferramentas). O core não conhece a autenticação do app.
- Rota `apps/mypet/app/api/duvidas/route.ts` passa `resolveIsBuyer: async () => Boolean(await requireBuyer())` (cookie HMAC `mypet_acesso` + buyer existente).
- Ferramenta `buscar_produtos({ query: string, marca?: string })`:
  - Usa `getCatalogLineItems({ q: query, brand, page: 1, channel })` — mesma fonte e cache da tabela; itens por SKU, variação expandida, preço real.
  - `marca` é resolvida contra `getBrands(channel)` sem diferenciar maiúsculas/acentos; se não casar com nenhuma marca, a busca segue sem filtro de marca.
  - Devolve ao modelo no máximo 8 itens: `{ id, nome, variacao, marca }` e, **só se cadastrado**, `preco` (`priceLabel`). Inclui `total`.
  - Guarda os itens encontrados (por id) para a resposta.
- `generateText` com `tools` e `stopWhen: stepCountIs(3)` quando `catalog` existe. `MAX_REPLY_TOKENS` e cota (1 unidade por pergunta, escopo `duvidas`) inalterados.
- Resposta:
  ```ts
  { ok: true, reply: string, products: SupportProduct[], showPrices: boolean }
  type SupportProduct = {
    id: string; name: string; sku: string; brand: string | null;
    variantLabel: string | null; priceLabel: string | null; // null para visitante
  };
  ```
  `products` = itens da **última** chamada de `buscar_produtos`, até 5, na ordem do resultado. Sem busca, `products: []`.
- Prompt (`buildSupportSystemPrompt` recebe `{ hasCatalog, isBuyer }`):
  - Regra 1: sem resposta na base → indicar `/central-de-ajuda` e convidar ao `/cadastro`. **Remover** "falar com o time pelo WhatsApp".
  - Com catálogo: usar `buscar_produtos` para qualquer pergunta sobre produto/marca/disponibilidade; nunca citar produto que não veio da ferramenta; não escrever preços no texto (a lista abaixo da resposta mostra); query com o tipo de produto, não a frase inteira.
  - Visitante: se perguntar preço, dizer que os preços aparecem para quem se cadastra com CNPJ e WhatsApp em `/cadastro`.
  - Cadastrado: pode indicar `/pedido-rapido` para montar o pedido.
  - Nunca prometer desconto, condição especial ou preço melhor; o agente se apresenta pela rapidez ("te mostro as opções", "monto sua lista").
  - Mantidas: português, texto simples, 1–4 frases; proibido "atacado", "cotação" e chamar o hotsite de "loja"; recusar assuntos fora do tema.
  - Remover o comentário de topo "Não usa ferramentas nem acessa catálogo/preço".

### 2. Mensagem de limite — `packages/core/src/ai-usage-limits.ts`

- `ip_daily`: "Você atingiu o limite de perguntas de hoje. Volte amanhã ou consulte a nossa central de ajuda." (sem WhatsApp). Afeta também o assistente do `/loja`, hoje oculto.

### 3. Cliente — `packages/core/src/support-assistant-client.ts`

- `SupportAssistantResult` de sucesso passa a ter `products: SupportProduct[]` e `showPrices: boolean`.
- Validação defensiva: `products` não-array ou itens malformados → descartados (lista vazia); `showPrices` ausente → `false`. Tipo `SupportProduct` exportado de um módulo sem dependências de servidor (o client não pode importar o server).

### 4. UI — `apps/mypet/app/_components/pre-access/faq-assistant.tsx`

- Estado local: mensagem da IA guarda `products` e `showPrices`; para a API só vão `role` e `content`.
- Abaixo da resposta, mini-lista (até 5): nome · variação · marca; à direita:
  - cadastrado: `priceLabel` + link `/pedido-rapido?q=<nome do produto>` (o nome do produto-pai é o que a busca da tabela casa; o SKU de variação não casa);
  - visitante: link "Cadastre-se para ver o preço" → `/cadastro`.
- `LINK_PATTERN` inclui `/pedido-rapido`.
- Chip novo de sugestão: "Vocês têm shampoo neutro?". Subtítulo: "Respostas automáticas com base na nossa central de ajuda e nos produtos da tabela."
- Estilos no mesmo arquivo de estilos da pré-acesso (classes `pa-ai-*`).

### 5. `/pedido-rapido` aceita `?q=`

- `apps/mypet/app/pedido-rapido/page.tsx` lê `searchParams.q` (conferir em `node_modules/next/dist/docs/` a forma de `searchParams` nesta versão do Next), busca a primeira página já filtrada e passa `initialQuery` para `PedidoRapidoTable`, que inicia o estado `q` com ele.
- Sem `q`, comportamento atual.

## Tratamento de erros

- Falha na busca do catálogo: `queryCatalogLineItems` já devolve lista vazia e loga; a ferramenta devolve `total: 0` e o modelo responde sem produtos.
- Falha em `resolveIsBuyer`: trata como visitante (falha fechada para preço).
- Falha de provedor: cadeia OpenAI → Gemini como hoje; tudo falhando → 502 com a mensagem atual.

## Testes

- Servidor:
  - visitante: resultado da ferramenta não contém preço; `products[].priceLabel === null`; `showPrices: false`;
  - cadastrado: preço presente na ferramenta e na resposta; `showPrices: true`;
  - sem `catalog`: `generateText` chamado sem `tools`;
  - `products` vem da última busca e é limitado a 5;
  - `marca` resolvida sem diferenciar caixa; marca desconhecida → busca sem filtro;
  - prompt não contém "WhatsApp" e contém a regra de não prometer desconto.
- `ai-usage-limits`: mensagem `ip_daily` sem WhatsApp.
- Cliente: parse de `products`/`showPrices` e descarte de itens malformados.
- Componente: mini-lista com preço + link `/pedido-rapido?q=` (cadastrado) e com link `/cadastro` (visitante).
- `/pedido-rapido`: `?q=` é repassado à busca inicial e à tabela.

## Fora do escopo

Adicionar ao carrinho pela caixa, busca por categoria, mudança de cotas, painel/landing nova (etapa 2), recursos do cliente cadastrado (etapa 3).
