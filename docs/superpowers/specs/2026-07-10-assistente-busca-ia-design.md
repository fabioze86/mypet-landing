# Assistente de compras com IA (busca conversacional + recomendação por perfil)

**Data:** 2026-07-10
**Status:** Aprovado — pronto para plano de implementação

## Contexto e problema

O catálogo hoje (`packages/core/src/components/catalog-section.tsx`) só permite busca
por nome de produto e filtro por marca. Não há como o visitante descrever o que
precisa em linguagem natural, nem como o site perceber se está falando com um pet
shop que vai revender os produtos ou com um banho-e-tosa que vai consumi-los — dois
perfis de comprador B2B com necessidades bem diferentes.

O objetivo é criar um bloco de destaque na home (inspirado na caixa "O que você quer
fazer primeiro?" de exemplos como o do Hostinger) que combine três coisas numa única
caixa conversacional: busca inteligente de produtos, inferência do perfil do
visitante e recomendação de produtos adequada a esse perfil.

### Estado real relevante (verificado em 2026-07-10)

- `packages/core/src/catalog.ts` / `catalog-utils.ts`: `queryCatalog` filtra apenas por
  `q` (nome, `ilike`) e `brand`. Não usa `products.category_id`.
- No Supabase `hub_catalogo` (projeto `hsguyfiyqpuligijcjlw`) existe uma tabela
  `categories` já populada com **85 categorias**, hierárquica (`parent_id`, `level`
  1–3), incluindo um ramo de nível 1 **"Banho & Tosa"** com subcategorias marcadas
  **"(PRO)"** (ex.: "Shampoos Profissionais (PRO)", "Perfumes e Estética (PRO)") e uma
  categoria de nível 1 **"Montagem de Loja"**. Essas categorias já são um sinal natural
  de perfil de comprador B2B (produtos "(PRO)" → banho-e-tosa; "Montagem de Loja" →
  pet shop novo), sem precisar inventar uma taxonomia própria.
- `products.category_id` existe e referencia `categories.id`, mas não é selecionado em
  nenhuma query hoje.
- Não há taxonomia pronta de "tipo de cliente" em nenhuma tabela (`email_segments`
  existe mas está vazia — não é reaproveitável aqui).
- Não há nenhuma dependência de SDK de IA instalada no monorepo (`ai`, `openai`,
  `@anthropic-ai/sdk`, `@ai-sdk/*` ausentes de todos os `package.json`), nem variável
  de ambiente relacionada a IA em uso.
- O padrão de extração de lógica server-side já estabelecido é: um arquivo plano em
  `packages/core/src/<nome>-server.ts` que exporta o handler (`POST`), reexportado por
  `apps/<app>/app/api/<rota>/route.ts` com uma linha (`export { POST } from
  "@mypet/core/leads-server"`). O mesmo padrão será seguido para o assistente.
- O monorepo já tem `apps/mypet` e `apps/distribuidora`, ambos consumindo
  `@mypet/core`, cada um com seu `client.config.ts` (`catalogChannel`, paleta, nome).

## Decisões tomadas

| Tema | Decisão |
|------|---------|
| Onde aparece | Novo bloco de destaque no topo da home, nos dois apps (`mypet` e `distribuidora`), coexistindo com o catálogo/filtro tradicional mais abaixo na página |
| Detecção de perfil | Híbrida: a IA infere pelo texto livre e pelas categorias buscadas na conversa; quando a confiança é baixa, a resposta inclui opções que a UI renderiza como chips de confirmação rápida |
| Persistência do perfil | Só em memória da sessão do visitante (estado React), **não** gravado no Supabase nesta fase — decisão de produto adiada |
| Provedor de IA | Abstração via **Vercel AI SDK** (`ai` + adapters `@ai-sdk/google` / `@ai-sdk/openai` / `@ai-sdk/anthropic`), com o modelo escolhido por variável de ambiente — troca de provedor não exige mudança de código |
| Modelo padrão | Google **Gemini 2.5 Flash** (custo/latência adequados a um widget público de alto tráfego) |
| Arquitetura de raciocínio | Claude/Gemini/OpenAI com **tool use**: uma ferramenta busca produtos de verdade (`queryCatalog`), outra lista a árvore de categorias — a IA nunca "inventa" produto, só escolhe entre o que a busca real retorna |
| Estado da conversa | Sem sessão persistida no servidor — o histórico da conversa viaja e volta a cada turno no corpo da requisição, como o `/api/leads` atual |
| Streaming | Fora do escopo da v1 — resposta única por turno, mais simples de implementar e testar |
| Exibição dos produtos sugeridos | Reaproveita `ProductCard` e `AddToCartControl` já existentes — a recomendação plugue no carrinho/cotação existente, sem checkout novo |

## Escopo

### Nesta entrega

- Expor categoria no catálogo: `category_id`/nome/slug em `CATALOG_SELECT`,
  `CatalogProduct` e `mapProduct`; nova função `getCategoryTree(channel)` cacheada;
  `queryCatalog` ganha filtro opcional por categoria.
- Novo pacote de lógica server-side `packages/core/src/assistant-server.ts`, exportando
  `POST`, seguindo o padrão do `leads-server.ts`.
- Abstração de modelo de IA (`packages/core/src/ai-provider.ts` ou similar) que lê
  `AI_PROVIDER` / `AI_MODEL` / a chave correspondente e devolve um modelo utilizável
  pelo Vercel AI SDK.
- Duas ferramentas (tools) para o modelo: `buscar_produtos` (chama `queryCatalog` com
  filtros de texto/categoria/marca) e `listar_categorias` (devolve a árvore cacheada).
- Novo componente de UI compartilhado (`packages/core/src/components/assistant-search.tsx`
  ou nome equivalente): caixa de texto, chips de sugestão inicial, área de resposta com
  texto + grade de produtos (reaproveitando `ProductCard`), chips de confirmação de
  perfil quando a confiança for baixa.
- Rotas `POST /api/assistant` em `apps/mypet` e `apps/distribuidora`, reexportando do
  core.
- Variáveis de ambiente novas documentadas em `ARCHITECTURE.md`: `AI_PROVIDER`,
  `AI_MODEL`, `GOOGLE_GENERATIVE_AI_API_KEY` (ou a chave do provedor escolhido).

### Fora de escopo (fases futuras)

- Persistir o perfil inferido do visitante em banco/CRM.
- Streaming de resposta token a token.
- Login/autenticação do visitante ou histórico de conversas entre sessões.
- Uso de Managed Agents / sessões de IA com estado no servidor — desnecessário para
  este caso de uso (busca + recomendação pontual, sem trabalho autônomo de longa
  duração).
- Métrica/dashboard de qualidade das respostas da IA.

## Arquitetura

```
Visitante digita na home
  → AssistantSearch (Client Component, packages/core/components)
  → POST /api/assistant { messages, channel }
  → apps/{app}/app/api/assistant/route.ts → @mypet/core/assistant-server
  → assistant-server.ts:
      - monta system prompt (explica os dois perfis de cliente B2B, pede pra IA
        usar as ferramentas em vez de inventar produto)
      - chama o modelo (Vercel AI SDK, generateText + tools) com o histórico
      - ferramenta buscar_produtos(query?, categorySlug?, brand?)
          → @mypet/core/catalog.ts queryCatalog({ q, categoryId, brand, channel })
      - ferramenta listar_categorias()
          → @mypet/core/catalog.ts getCategoryTree(channel)  [cacheada, "use cache"]
      - modelo devolve texto final + decide quais produtos exibir
  ← { reply, products, profileGuess?, profileOptions? }
  → AssistantSearch renderiza texto + grade de ProductCard + (se profileOptions)
    chips de confirmação de perfil
```

### Contrato de `POST /api/assistant`

Entrada:

```ts
type AssistantRequest = {
  channel: string; // clientConfig.catalogChannel do app
  messages: { role: "user" | "assistant"; content: string }[];
};
```

Saída (sucesso):

```ts
type AssistantResponse = {
  ok: true;
  reply: string;
  products: CatalogProduct[]; // reaproveita o tipo já existente em catalog-utils.ts
  profileGuess?: { label: "pet_shop" | "banho_tosa" | "outro"; confidence: "alta" | "baixa" };
  profileOptions?: { label: string; value: string }[]; // presente só quando confidence = "baixa"
};
```

Saída (erro), seguindo o padrão já recomendado no `ARCHITECTURE.md`:

```json
{ "ok": false, "error": { "code": "AI_PROVIDER_ERROR", "message": "..." } }
```

Códigos de erro previstos: `INVALID_INPUT` (mensagens vazias/malformadas),
`AI_PROVIDER_ERROR` (falha do provedor de IA — timeout, 5xx, chave inválida),
`CATALOG_ERROR` (falha ao consultar o Supabase durante uma tool call).

### Detecção de perfil (híbrida)

- O system prompt descreve os dois perfis principais (pet shop revendedor vs.
  banho-e-tosa consumidor) e pede à IA para inferir a partir de pistas no texto
  ("quero produtos pra tosa", "vou abrir uma loja", "atendo clientes que trazem o
  pet") e das categorias que ela mesma escolheu buscar na conversa (ex.: se ela
  buscou repetidamente em "Banho & Tosa (PRO)", o perfil provável é banho-e-tosa).
- A IA devolve `profileGuess` estruturado. Quando `confidence: "baixa"`, também
  devolve `profileOptions` (2–3 alternativas) — a UI renderiza como chips clicáveis;
  ao clicar, o texto do chip vira uma nova mensagem de usuário no histórico, sem a
  pessoa precisar digitar.
- `profileGuess` fica em estado local do componente (`useState`), usado para:
  personalizar a saudação inicial da caixa (ex.: depois de identificado, mostrar um
  atalho "Ver kits pra Banho & Tosa") e para dar preferência a essas categorias nas
  próximas buscas da mesma sessão (via um parâmetro extra enviado nas próximas
  chamadas, não persistido).

### Abstração de provedor de IA

`packages/core/src/ai-provider.ts` expõe uma função `getAssistantModel()` que lê:

- `AI_PROVIDER`: `"google" | "openai" | "anthropic"` (default `"google"`)
- `AI_MODEL`: string do modelo (default `"gemini-2.5-flash"`)
- a chave correspondente (`GOOGLE_GENERATIVE_AI_API_KEY` / `OPENAI_API_KEY` /
  `ANTHROPIC_API_KEY`)

e devolve o objeto de modelo do Vercel AI SDK (`google("gemini-2.5-flash")`, etc.),
usado por `generateText({ model, tools, messages })` dentro de `assistant-server.ts`.
Trocar de provedor para testar é mudar duas variáveis de ambiente e reiniciar o app —
nenhum código muda.

## Tratamento de erros e casos de borda

- **Provedor de IA indisponível/erro/timeout:** `assistant-server.ts` captura e
  devolve `{ok:false, error:{code:"AI_PROVIDER_ERROR", ...}}`; a UI mostra uma
  mensagem genérica e mantém a caixa de busca tradicional como alternativa (ela já
  existe mais abaixo na página).
- **Nenhum produto encontrado pelas tools:** a IA deve responder com texto
  reconhecendo isso e sugerindo reformular — mesmo comportamento do estado vazio já
  existente no `CatalogSection`.
- **Mensagem vazia ou só espaços:** validada no `assistant-server.ts` antes de chamar
  o provedor (`INVALID_INPUT`, 400), sem gastar uma chamada de IA.
- **Canal sem categorias populares ainda** (ex. distribuidora): `getCategoryTree`
  retorna a árvore inteira (categorias não são por canal, só produtos são) — não há
  caso de borda aqui além do catálogo geral já poder estar vazio para o canal.
- **Histórico de conversa muito longo:** fora de escopo tratar nesta fase (conversas
  de busca tendem a ser curtas); se necessário, truncar as mensagens mais antigas no
  servidor antes de repassar ao provedor.

## Estratégia de testes

- Unitários em `catalog-utils.test.ts`/`catalog.test.ts`: mapeamento de categoria em
  `mapProduct`, filtro por categoria em `queryCatalog`.
- Unitário para `ai-provider.ts`: resolução correta do modelo a partir de
  combinações de `AI_PROVIDER`/`AI_MODEL`/env vars, incluindo o default.
- Unitário para `assistant-server.ts`: validação de entrada (`INVALID_INPUT`),
  roteamento das tool calls mockando o provedor de IA (sem chamada de rede real),
  formatação do contrato de resposta.
- Validação manual via `/run`: rodar localmente com Gemini 2.5 Flash, simular 3
  conversas (pet shop novo, banho-e-tosa, "ainda não sei") e confirmar que os
  produtos batem com a categoria esperada e que os chips de confirmação de perfil
  aparecem quando a mensagem é ambígua.

## Riscos e mitigações

- **A IA "alucinar" produtos que não existem:** mitigado pela arquitetura de tool
  use — a IA só pode citar produtos que vieram de uma chamada real a
  `buscar_produtos`; o texto final deve ser instruído a só mencionar itens da lista
  retornada.
- **Custo/latência de IA em página pública de alto tráfego:** mitigado pela escolha
  de um modelo rápido/barato por padrão (Gemini 2.5 Flash) e pela ausência de
  streaming/sessão com estado, que simplifica e barateia cada chamada.
- **Ficar preso a um único provedor de IA:** mitigado pela abstração via Vercel AI
  SDK — trocar provedor é configuração, não código.
- **Categoria mal populada em alguns produtos** (`category_id` nulo): a ferramenta
  `buscar_produtos` deve continuar aceitando busca por texto mesmo sem categoria,
  então produtos sem categoria continuam encontráveis, só não entram no
  agrupamento por categoria.
