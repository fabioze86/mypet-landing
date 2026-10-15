# Agente My Pet — plataforma `/agente`

Data: 2026-10-14
Status: aprovado
Substitui: `2026-10-14-agente-etapa1-catalogo-design.md` (a etapa 1 virou parte do bloco 1 abaixo)

## Contexto

O mypet (`apps/mypet`) é a "Tabela de Preços My Pet Brasil": cadastro com CNPJ + WhatsApp libera os preços (iguais aos do mypetbrasil.com), o cliente monta o pedido em `/pedido-rapido` e envia pelo WhatsApp. Hoje existe só uma caixinha de dúvidas com IA no FAQ da home (`/api/duvidas`), que responde com FAQ + Central de Ajuda.

A visão: o agente vira peça central do canal, numa área própria, atendendo dois públicos:

- **Lead frio**: tira dúvidas (frete, prazos, pagamento, pedido mínimo) e conhece produtos **sem preço**. Saída sempre pelo cadastro — nunca para o WhatsApp do time (lead frio no atendimento já é um problema hoje).
- **Cliente cadastrado**: compra com conveniência e rapidez — preços, montar o pedido conversando, saber o que repor, acompanhar pedidos.

O valor do agente é **conveniência e rapidez**. Ele nunca negocia, nunca promete desconto, condição especial ou preço melhor.

## Decisões

| Tema | Decisão |
|---|---|
| Onde mora | Rota nova `/agente` dentro de `apps/mypet` (reaproveita login, carrinho, `/pedido-rapido`, fechamento WhatsApp, `/pedidos`). |
| Primeira tela do lead | Agente aberto + recursos exclusivos com cadeado + cadastro inline ao lado (sem barreira na entrada). |
| Recursos do cliente (v1) | Montar o pedido conversando; sugerir reposição pela compra habitual; status dos pedidos. **Não** inclui "repetir último pedido". |
| Fechamento | Carrinho ao lado do chat (ao vivo, editável), botão "Enviar pedido pelo WhatsApp" com o fechamento atual. |
| Pós-login | Cadastro/login levam para `/agente` (antes: `/pedido-rapido`). |
| Abertura do cliente | Tela neutra com cartões fixos (sem saudação gerada por IA nem cartões calculados). |
| Conversas | Guardadas no Supabase, ligadas ao comprador quando houver. |
| Home | A caixinha de dúvidas vira porta de entrada: campo que leva a `/agente` com a pergunta já enviada. Um agente só. |
| Transporte | Streaming (AI SDK `streamText` + `useChat` de `@ai-sdk/react`, dependência nova). |

## 1. Telas

### 1.1 `/agente` — visitante

Duas colunas (≥ 900px): à esquerda o painel do agente (referência: painel da Hostinger), à direita o painel de acesso completo (referência: login da Clara).

**Painel do agente**
- Cabeçalho "Agente My Pet".
- Estado inicial (sem mensagens): título "Como posso te ajudar hoje?" e cartões:
  - livres: "Encontrar produtos", "Frete e prazos de entrega", "Pagamento e pedido mínimo";
  - separador "exclusivo para cadastrados";
  - com cadeado: "Ver preços", "Montar meu pedido", "Acompanhar meus pedidos".
- Cartão livre envia uma pergunta pronta ao agente. Cartão com cadeado **não** chama a IA: destaca o painel de acesso com texto do contexto (ex.: "Cadastre-se para ver os preços").
- Campo "Pergunte qualquer coisa…" fixo embaixo (máx. 500 caracteres) + aviso "Respostas automáticas podem conter erros."
- Produtos encontrados aparecem como cartões compactos sob a resposta (nome, variação, marca, imagem) com "Cadastre-se para ver o preço".

**Painel de acesso completo**
- Título "Acesso completo ao agente", lista de benefícios (preços da tabela; monta seu pedido conversando; sugere o que repor; acompanha seus pedidos) e o formulário de cadastro existente (`AccessForm`: CNPJ e WhatsApp obrigatórios, e-mail opcional).
- No sucesso, a página passa ao modo cliente **mantendo a conversa** (ver 3.4).

**Celular (< 900px)**: o agente ocupa a tela; o painel de acesso vira faixa "Liberar acesso completo" que abre o formulário em painel inferior (bottom sheet).

**Copy**: nada de "atacado", "cotação", nem chamar o hotsite de "loja"; nenhum link/menção ao WhatsApp do time.

### 1.2 `/agente` — cliente

- Painel do agente com abertura neutra "Como posso te ajudar hoje?" e cartões fixos: "Montar um pedido", "O que preciso repor?", "Status dos meus pedidos", "Frete e prazos".
- Cartões de produto sob a resposta mostram preço e botão "Adicionar" (adiciona 1 un. direto no carrinho, sem IA).
- Coluna direita: **carrinho** — mesmo `CartProvider` (localStorage) usado por `/pedido-rapido`, então o que entra por um aparece no outro. Itens com stepper de quantidade e remoção, total e botão "Enviar pedido pelo WhatsApp" usando `finalizeQuote` + a montagem de mensagem/link já usadas em `/cotacao`.
- Celular: barra fixa inferior "Seu pedido · N itens · R$ X" que abre o carrinho em painel inferior.
- Menu do cliente (`SiteNav`) ganha o item "Agente"; a tabela continua no menu.

### 1.3 Home e redirecionamentos

- `CommercialFaq` troca o `FaqAssistant` por um campo "Pergunte ao agente My Pet" que navega para `/agente?pergunta=<texto>`; o `/agente` envia essa pergunta automaticamente ao abrir (uma vez) e limpa o parâmetro da URL.
- O hero e o cabeçalho da home ganham um botão para `/agente`.
- Sucesso do cadastro (`access-form.tsx`) e do login (`/entrar` e callback) redirecionam para `/agente`.
- `/api/duvidas`, `FaqAssistant` e `support-assistant-client.ts` são removidos depois que a home deixa de usá-los (o `support-assistant-server.ts` é absorvido pelo servidor do agente).

## 2. Servidor do agente

### 2.1 Rota

`POST /api/agente` em `apps/mypet/app/api/agente/route.ts`, montada por um handler do core (`packages/core/src/agent-server.ts`), no mesmo estilo de `createSupportAssistantHandler`:

```ts
createAgentHandler({
  channel, siteName, faq,
  resolveBuyer: (req) => Promise<{ id: string; empresa: string | null } | null>,
})
```

Fluxo: `rejectForeignRequest` → validação do corpo → identificação do comprador (falha = visitante) → cota → conversa (cria/recupera) → `streamText` com prompt e ferramentas do modo → resposta em stream de UI messages → ao terminar, grava as mensagens.

**Corpo da requisição** (`useChat` com `prepareSendMessagesRequest`): `id` da conversa (uuid gerado no cliente), `message` (**só a última mensagem do usuário**: UI message com partes de texto, até 500 caracteres) e `cart` (snapshot do carrinho: `{ id, name, qty, unitPrice }[]`, máx. 50 itens, validado). O histórico é carregado **do banco** (últimas 12 mensagens da conversa) — o servidor nunca confia em mensagens de assistente ou resultados de ferramenta enviados pelo navegador (evita preço ou produto forjado no histórico).

**Modo** é decidido só no servidor pelo cookie (`requireBuyer`). Nenhum dado do corpo altera o modo nem o comprador.

### 2.2 Prompt

Base de conhecimento igual à atual (FAQ comercial + artigos publicados da Central de Ajuda, mesmos limites de tamanho). Regras comuns:

1. Dúvidas comerciais (cadastro, pedidos, pagamento, entrega) só com base na base de conhecimento; sem resposta → indicar `/central-de-ajuda` (e, para visitante, convidar ao cadastro).
2. Nunca inventar regras, valores, prazos, preços ou estoque. Nunca prometer desconto, condição especial ou preço melhor (preços iguais aos do mypetbrasil.com).
3. Citar o caminho do artigo quando a resposta vier dele.
4. Português, texto simples, 1 a 4 frases, direto.
5. Proibido "atacado", "cotação" e chamar a My Pet Brasil de "loja".
6. Fora do tema → recusar educadamente.
7. Produto só pode ser citado se veio de `buscar_produtos` nesta conversa; buscar pelo tipo/nome do produto, não pela frase inteira; não escrever preços no texto (os cartões mostram).

Visitante: preço → "os preços aparecem para quem se cadastra com CNPJ e WhatsApp"; pedidos/reposição → explicar que são recursos de quem tem cadastro.

Cliente: recebe o nome da empresa e o carrinho atual no prompt; ao alterar o pedido, confirmar em uma frase o que mudou; para fechar, indicar o botão "Enviar pedido pelo WhatsApp".

### 2.3 Ferramentas

| Ferramenta | Visitante | Cliente | Contrato |
|---|:---:|:---:|---|
| `buscar_produtos({ query, marca? })` | ✓ | ✓ | `getCatalogLineItems` (page 1, canal); marca resolvida contra `getBrands` sem diferenciar caixa/acentos (desconhecida → sem filtro). Até 8 itens ao modelo: `{ id, nome, variacao, marca }` + `preco` **só para cliente**. A saída da ferramenta (para a UI) leva `{ id, name, sku, brand, variantLabel, img, unitPrice, priceLabel }` com `unitPrice`/`priceLabel` = `null` para visitante. |
| `alterar_pedido({ itens: [{ productId, quantidade }] })` | — | ✓ | Até 20 itens por chamada; `quantidade` inteiro 0–9999 (0 remove). O servidor carrega cada produto do canal (ativo, com preço) e devolve `{ aplicados: [{ id, name, sku, brand, img, unitPrice, qty }], recusados: [{ productId, motivo }] }`. O navegador aplica `aplicados` no carrinho **quando a resposta termina** (`onFinish` do `useChat`), inclusive se ela for interrompida, e não no instante da saída da ferramenta; só saídas completas (`output-available`) de respostas novas contam, nunca mensagens restauradas. Cada item define a linha sem campanha do produto (`setLine`: quantidade final + preço/nome/sku/marca/imagem atuais); linhas de campanha não são tocadas. Valem ids de `buscar_produtos`, `sugerir_reposicao` ou do pedido atual; "mais N" = quantidade atual + N. Produto sem preço é recusado. |
| `sugerir_reposicao()` | — | ✓ | Lê `getOrdersByBuyer` do comprador do cookie (pedidos não cancelados). Por produto com compras em ≥ 2 dias distintos (UTC; pedidos do mesmo dia somam na mesma compra): intervalo médio entre compras e dias desde a última; sugere quem passou de 80% do intervalo médio, ordenado por atraso, máx. 8. Com < 2 compras por produto, devolve os itens do último pedido como "compra recente". Cálculo em código puro e testável (`agent-replenishment.ts`). Devolve `{ id, name, ultimaCompraDias, intervaloMedioDias | null, qtdUltimaCompra }` + preço atual. |
| `status_pedidos({ limite? })` | — | ✓ | Últimos pedidos (padrão 5, máx. 10) do comprador do cookie: `{ data, status, itens, unidades }`. |

Segurança: o comprador vem **só** do cookie; nenhuma ferramenta aceita id de comprador; visitante não recebe as ferramentas de cliente; para visitante o preço não entra no contexto do modelo.

Execução: `streamText` com `stopWhen: stepCountIs(5)`, `maxOutputTokens: 600`, timeout de 25s.

### 2.4 Provedores

Cadeia atual (OpenAI → Gemini via `getAssistantModelChain`). Com streaming, troca para o próximo provedor só se a falha ocorrer **antes do primeiro trecho** enviado; depois disso, o erro vai como mensagem de erro no stream e a UI mostra "Não foi possível responder agora. Tente novamente."

### 2.5 Cotas

- Visitante: `consumeAiQuota("duvidas", channel, headers)` como hoje (por IP).
- Cliente: novo escopo `agente_cliente` contado **por comprador**: `consume_ai_quota` recebe em `p_ip_hash` o hash do id do comprador (sem mudar a função SQL; o escopo separa os contadores). Padrões: rajada 20/10 min, 80/dia por comprador, teto global 3000/dia; ajustáveis por `AI_LIMIT_AGENTE_CLIENTE_*`.
- Mensagem `ip_daily`: "Você atingiu o limite de perguntas de hoje. Volte amanhã ou consulte a nossa central de ajuda." (sem WhatsApp).

## 3. Dados

### 3.1 Tabelas novas (migration Supabase)

```sql
agent_conversations (
  id uuid primary key,              -- gerado no cliente (useChat id)
  channel text not null,
  buyer_id uuid null references buyers(id),
  ip_hash text not null,
  started_as text not null check (started_as in ('visitante','cliente')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)

agent_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references agent_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  message_id text not null,         -- id da UI message (useChat)
  content text not null,            -- texto da mensagem (para leitura)
  parts jsonb not null,             -- UI message parts completas (texto + ferramentas), usadas para recarregar o histórico
  mode text not null check (mode in ('visitante','cliente')),
  created_at timestamptz not null default now(),
  unique (conversation_id, message_id)
)
```

RLS ligado, sem políticas para `anon`/`authenticated` (só o service role do servidor escreve/lê). Índices por `buyer_id` e `created_at`.

### 3.2 Gravação

Antes de responder: cria a conversa se não existe; se existe sem `buyer_id` e o pedido vem de um cliente, grava o `buyer_id` (conversão). Se a conversa pertence a **outro** comprador (ou a um comprador e o pedido vem de visitante), responde 403 `CONVERSATION_FORBIDDEN` e o navegador começa uma conversa nova. No fim de cada resposta: upsert (por `conversation_id` + `message_id`) da mensagem do usuário e da resposta, e atualiza `updated_at`. Falha do banco é logada e não derruba a resposta (segue sem histórico e sem gravar).

### 3.3 Origem dos pedidos

`orders` ganha `agent_conversation_id uuid null references agent_conversations(id)`. O botão de envio do `/agente` chama `finalizeQuote(items, { agentConversationId })`; `createOrder` grava o campo. Pedidos de `/pedido-rapido`/`/cotacao` seguem com `null`.

### 3.4 Cadastro no meio da conversa

A conversa (id + mensagens) fica em `sessionStorage` enquanto a página está aberta. No sucesso do cadastro dentro do `/agente`, a página recarrega em modo cliente, restaura id e mensagens, e a próxima resposta grava o `buyer_id` na conversa — é o que mede conversão de lead pelo agente.

### 3.5 LGPD

Pendência do negócio (fora do código): atualizar o texto de privacidade para informar que as conversas com o agente são guardadas para melhorar o atendimento. O rodapé do `/agente` exibe uma linha curta com essa informação.

## 4. Erros

- Falha em identificar comprador → visitante.
- Catálogo fora do ar → ferramenta devolve lista vazia; agente diz que não encontrou.
- `alterar_pedido` com produto inexistente/sem preço → vai em `recusados`; agente informa.
- Cota estourada → 429 com a mensagem da cota, exibida no lugar da resposta.
- `finalizeQuote` falhando → mensagem de erro no carrinho, carrinho preservado.

## 5. Testes

- Core: prompt por modo (sem WhatsApp, sem promessa de desconto, regras de produto); ferramentas por modo (visitante sem preço e sem ferramentas de cliente; cliente com preço); `alterar_pedido` (aplicados/recusados, limites); reposição (cálculo puro com datas fixas); status; cotas por escopo; gravação da conversa (mock do Supabase); fallback de provedor antes do primeiro trecho.
- App: rota liga `resolveBuyer`; página `/agente` renderiza modo visitante/cliente conforme `requireBuyer`; cartões com cadeado abrem o cadastro sem chamar a IA; carrinho reage à saída de `alterar_pedido`; `?pergunta=` envia uma vez; home leva a `/agente`; redirecionamentos pós-login apontam para `/agente`.
- Manual: os dois modos ponta a ponta no navegador (desktop e 375px), cadastro no meio da conversa, envio pelo WhatsApp gravando `agent_conversation_id`.

## 6. Blocos de entrega

Cada bloco tem plano próprio e deixa o sistema funcionando:

1. **Cérebro** — `@ai-sdk/react`/streaming, `agent-server.ts`, `/api/agente`, prompt, `buscar_produtos`, dois modos, cotas (incl. `agente_cliente` e mensagem sem WhatsApp), tabelas e gravação de conversas. Testável por chamada à API.
2. **Modo visitante** — página `/agente` (painel + cadeados + cadastro inline + celular), home como porta de entrada, redirecionamentos pós-login, remoção de `/api/duvidas` e `FaqAssistant`.
3. **Modo cliente** — carrinho ao lado/barra no celular, `alterar_pedido`, `sugerir_reposicao`, `status_pedidos`, botão "Adicionar" nos cartões, envio pelo WhatsApp com `agent_conversation_id`, item "Agente" no menu.

Antes de codar o bloco 1: ler a documentação do AI SDK instalado (`node_modules/ai`, versão 7) sobre `streamText`/UI messages e do `@ai-sdk/react` sobre `useChat`, e `node_modules/next/dist/docs/` para route handlers com streaming nesta versão do Next.

## Fora do escopo

Repetir último pedido, saudação/cartões personalizados na abertura, aviso ativo de promoção, contato humano no agente (para cliente fica para depois; para visitante, nunca), tela de leitura de conversas no admin, negociação de condições.
