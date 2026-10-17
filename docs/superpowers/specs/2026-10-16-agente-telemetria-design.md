# Agente /agente — telemetria (especificação A)

Data: 2026-10-16
Status: aprovado
Escopo: `packages/core` (agente) + migration no Supabase hub_catalogo.

## Contexto

O agente `/agente` (`packages/core/src/agent-server.ts`) grava conversas em
`agent_conversations` e `agent_messages`, mas só grava turnos que terminaram
bem e têm texto (`shouldSaveTurn`). Tudo que dá errado se perde: erro de
provedor, resposta abortada, resposta vazia, bloqueio por cota, conversa
proibida, mensagem duplicada. Também não fica registrado qual provedor
respondeu (OpenAI ou Gemini, via `openStreamWithFallback`), quanto tempo
levou nem quantos tokens custou.

Esta é a especificação A de duas. A especificação B (dashboard de conversas
no `apps/admin`, com lista ao vivo, conversa completa, indicadores e
Realtime) consome os dados gravados aqui. A vem primeiro porque cada dia sem
ela é histórico perdido.

## Objetivo

1. Toda resposta bem-sucedida do agente registra provedor, modelo, latência,
   tempo até o primeiro conteúdo, tokens e número de passos.
2. Todo turno que não vira resposta normal registra um evento com motivo e o
   texto da pergunta.
3. Todo turno que chega ao modelo registra `turn_started` no momento do
   envio, para o dashboard mostrar ao vivo quem está aguardando resposta.
4. A telemetria nunca muda o que o usuário recebe nem derruba uma resposta.

## Decisões

- **Texto da pergunta em todos os eventos**, inclusive bloqueio por cota
  (decisão do usuário: ver o que a pessoa perguntou e ficou sem resposta).
- **Retenção:** eventos de `agent_events` são apagados após 90 dias.
  Conversas e mensagens normais não têm prazo.
- **Estrutura:** métricas de sucesso como colunas em `agent_messages` (linha
  `assistant`); exceções numa tabela nova `agent_events`. Descartadas: tabela
  `agent_turns` para todo turno (mudança maior, retenção por status) e tudo
  em `agent_events` (a retenção apagaria as métricas boas).

## Modelo de dados

### `agent_messages` — colunas novas

Todas nulas por padrão; preenchidas só na linha `role = 'assistant'`.
Mensagens antigas ficam nulas.

| coluna | tipo | conteúdo |
|---|---|---|
| `provider` | text | provedor que respondeu de fato (`openai`, `google`, `google-vertex`) |
| `model` | text | id do modelo |
| `latency_ms` | integer | do início do handler até o fim da resposta |
| `first_token_ms` | integer | do início do handler até o primeiro conteúdo do modelo |
| `input_tokens` | integer | soma de todos os passos |
| `output_tokens` | integer | soma de todos os passos |
| `steps` | integer | passos usados (máximo `MAX_STEPS = 5`) |

### `agent_events` — tabela nova

| coluna | tipo | conteúdo |
|---|---|---|
| `id` | bigint identity, PK | |
| `created_at` | timestamptz, default now() | |
| `conversation_id` | uuid, nulo, **sem FK** | o evento pode ser de conversa que nunca foi criada ou que não pertence ao solicitante |
| `channel` | text, not null | |
| `mode` | text, nulo, check `visitante`/`cliente` | |
| `buyer_id` | uuid, nulo, sem FK | comprador do cookie, se houver |
| `ip_hash` | text, not null | `hashClientIp` |
| `kind` | text, not null, check | ver tabela abaixo |
| `detail` | jsonb, default `{}` | motivo da cota, provedor que falhou, erro resumido (até 500 caracteres) |
| `question` | text, nulo | texto da pergunta (`messageText`) |
| `provider` | text, nulo | quando aplicável |
| `latency_ms` | integer, nulo | quando aplicável |

Índices: `(created_at desc)` e `(kind, created_at desc)`.
Acesso: RLS ligado, `revoke all ... from anon, authenticated`. Só o
`service_role` grava e lê, igual às demais tabelas do agente.

### Tipos de evento (`kind`)

| kind | quando | `detail` |
|---|---|---|
| `turn_started` | a pergunta passou por cota, posse da conversa e duplicidade, e o modelo vai ser chamado | `{ message_id }` (id da pergunta, o mesmo `message_id` da linha `user` gravada no fim) |
| `quota_blocked` | `consumeAiQuota` negou | `{ reason: "ip_burst" \| "ip_daily" \| "global_daily" \| "disabled" \| "unavailable" }` |
| `conversation_forbidden` | `ensureConversation` devolveu `forbidden` | `{}` |
| `duplicate_message` | id da mensagem já está no histórico | `{ message_id }` |
| `provider_fallback` | um provedor falhou antes do primeiro conteúdo e outro assumiu (um evento por provedor que falhou) | `{ failed_provider, error }` |
| `provider_error` | todos os provedores falharam antes do primeiro conteúdo (502), ou erro no meio do stream | `{ failures: [{ provider, error }] }` ou `{ finish_reason }` |
| `aborted` | `onEnd` com `isAborted = true` | `{}` |
| `empty_reply` | `onEnd` terminou bem mas sem texto | `{ finish_reason }` |

`turn_started` é o único tipo que não é exceção: existe para o dashboard
(especificação B) mostrar "aguardando resposta" ao vivo. O turno está em
andamento enquanto não houver, para o mesmo `conversation_id` e depois do
`turn_started`, a linha `user` com o mesmo `message_id` em `agent_messages`
nem um evento terminal (`provider_error`, `aborted`, `empty_reply`). Como
último recurso, o dashboard considera encerrado o turno com mais de 60 s,
para cobrir a morte da função sem `onEnd`.

### Retenção

A migration habilita `pg_cron` (disponível no projeto, ainda não
instalado) e agenda um job diário às 03:00 UTC:

```sql
delete from public.agent_events where created_at < now() - interval '90 days';
```

Idempotente: desagenda o job pelo nome, se existir, antes de agendar.

## Captura no fluxo

### Módulo novo `packages/core/src/agent-events.ts`

- `recordAgentEvent(supabase, event)`: monta a linha e insere em
  `agent_events`. Nunca lança erro; falhas vão para
  `console.error("[agent-events] ...")`.
- Executado depois da resposta, via `after()` do `next/server`, para não somar
  latência. Confirmar a API em `node_modules/next/dist/docs/` antes de
  implementar.
- Resume erros para `detail.error`: mensagem do erro, até 500 caracteres,
  sem stack.

### Mudanças no que já existe

1. **`openStreamWithFallback`** (`agent-stream.ts`) passa a devolver
   `{ stream, provider, index, failures } | { stream: null, failures }`,
   em que `failures` é `[{ provider, error }]` dos provedores que caíram
   antes do primeiro conteúdo.
2. **`ai-usage-limits.ts`**: nova função exportada que devolve
   `{ response, reason } | null`. `consumeAiQuota` passa a usá-la e mantém
   assinatura e comportamento atuais.
3. **`saveTurn`** (`agent-conversations.ts`) aceita `metrics` opcional,
   gravado só nas linhas `assistant`.
4. **Candidatos do stream** em `agent-server.ts` guardam o resultado do
   `streamText`, para o handler ler `totalUsage` e `steps` do vencedor.

### Pontos de captura em `agent-server.ts`

- `t0 = Date.now()` no início do handler.
- Cota negada → `quota_blocked`.
- `access === "forbidden"` → `conversation_forbidden`.
- Id repetido → `duplicate_message`.
- Logo antes de chamar o modelo → `turn_started`. **Exceção ao `after()`:**
  com streaming, o `after()` só roda quando a resposta termina, o que
  anularia o "ao vivo". O insert é disparado sem `await` antes do stream, e
  a promessa é aguardada no `onEnd` (ou no caminho do 502), para a função
  não morrer com o insert pendente. Não soma latência à resposta.
- Após `openStreamWithFallback`:
  - `first_token_ms = Date.now() - t0`;
  - um `provider_fallback` por item de `failures`, se houve vencedor;
  - sem vencedor → `provider_error` com todas as falhas.
- No `onEnd`:
  - `shouldSaveTurn = true` → aguarda `totalUsage` e `steps` do vencedor com
    limite de 2 s; calcula `latency_ms`; chama `saveTurn` com as métricas.
    Se o uso não vier no limite, grava com as colunas de tokens nulas.
  - `shouldSaveTurn = false` → `aborted`, `provider_error` (`finishReason =
    "error"`) ou `empty_reply`.

Os eventos gravados antes da conversa existir, ou sem banco disponível,
seguem estas regras:

- Os eventos usam o cliente `service_role` (`getHubServiceClient`) mesmo
  quando `ensureConversation` não rodou (como no bloqueio por cota).
- Se não for possível obter o cliente, o evento é descartado com log.

## Tratamento de falhas

- Respostas, códigos HTTP e mensagens ao usuário continuam idênticos.
- Falha ao gravar evento ou métrica: apenas log.
- Se o Supabase estiver indisponível, nada é gravado. É aceito.

## Testes (Vitest)

- `agent-server.test.ts` (turno): `turn_started` gravado antes do stream,
  com o `message_id` da pergunta, nos caminhos feliz, 502 e abortado; não
  gravado em cota, conversa proibida ou duplicada.
- `agent-events.test.ts`: linha montada por tipo; resumo de erro; erro do
  Supabase engolido.
- `agent-stream.test.ts`: retorno com `provider` e `failures` (uma falha e um
  sucesso; todas falham; sucesso direto).
- `agent-server.test.ts`: um caso por tipo de evento, verificando o evento e
  que a resposta não mudou; caso feliz com `provider`, tokens, `steps` e
  latências na linha `assistant`; uso indisponível grava com tokens nulos.
- `ai-usage-limits.test.ts`: motivo exposto pela função nova;
  `consumeAiQuota` inalterada.
- `agent-conversations.test.ts`: `saveTurn` grava `metrics` só na linha
  `assistant`.

## Implantação

1. Aplicar a migration no Supabase hub_catalogo (`hsguyfiyqpuligijcjlw`).
2. Fazer o deploy do código. Na ordem inversa, o código novo apenas logaria
   erro ao gravar, sem quebrar respostas.
3. Verificar com uma conversa real em produção e uma consulta a
   `agent_messages` e `agent_events`.

## Fora de escopo

- Custo em R$: o dashboard (especificação B) calcula a partir dos tokens.
- `agent_search_log`: pertence ao agente WhatsApp do Hub Comercial V2, não
  ao `/agente`. As buscas do `/agente` já ficam nas `parts` das mensagens.
- Erros 400 de entrada inválida: não chegam a ter conversa nem pergunta
  válida.
- Presença ("página aberta sem perguntar"): fica para depois, se for preciso
  medir abandono. Exigiria rota de sinal periódico e tabela temporária; o
  Presence do Supabase pelo navegador do visitante não serve, porque com a
  chave pública qualquer pessoa assinaria o canal.
- Dashboard, Realtime e policies de leitura: especificação B. Escopo já
  decidido para B, no "ao vivo": (1) mensagens aparecendo pelo Realtime em
  `agent_messages`; (2) "conversando agora" (conversas com mensagem nos
  últimos 5 minutos) e "aguardando resposta" (a partir de `turn_started`,
  via Realtime em `agent_events`). Nota para B:
  o signup do Supabase Auth está aberto, então `authenticated` vale como
  "qualquer pessoa". Qualquer leitura pelo navegador precisa exigir
  `exists (select 1 from admin_users where id = auth.uid())`.
