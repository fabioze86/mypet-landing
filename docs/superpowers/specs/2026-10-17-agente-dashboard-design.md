# Agente /agente — painel de conversas (especificação B)

Data: 2026-10-17
Status: aprovado
Escopo: `apps/admin` + migration no Supabase hub_catalogo.
Depende de: especificação A (`2026-10-16-agente-telemetria-design.md`), já em produção.

## Contexto

O agente `/agente` grava conversas em `agent_conversations` e
`agent_messages`. Desde a especificação A, também grava métricas por resposta
(provedor, modelo, latências, tokens, passos) e eventos em `agent_events`:
`turn_started`, falhas, trocas de provedor e bloqueios por cota. Hoje não há
tela para ver nada disso; só o Table Editor do Supabase.

O `apps/admin` é o painel interno: login pelo Supabase Auth, autorização pela
tabela `admin_users` (papéis `admin` e `editor`), e telas que leem com a
sessão do usuário (chave pública + cookie), protegidas por policies de RLS do
tipo `exists (select 1 from admin_users where id = auth.uid())`, como
`orders_admin_all` e `buyers_admin_select`.

O signup do Supabase Auth do hub_catalogo é aberto: a role `authenticated`
vale como "qualquer pessoa". Toda leitura precisa da checagem de
`admin_users`.

## Objetivo

1. Uma lista das conversas do agente que se atualiza ao vivo, com indicadores
   do período.
2. Uma página por conversa com a linha do tempo completa: perguntas,
   respostas, métricas, ferramentas usadas, falhas e pedido ligado.
3. Acesso só para quem está em `admin_users`, garantido no banco.

## Decisões

- **Quem vê:** todos em `admin_users`, admin e editor (mesmo critério de
  pedidos e clientes).
- **Formato:** lista e página de detalhe separadas, como Pedidos.
- **Indicadores:** volume e ao vivo, saúde da IA, velocidade e custo.
  Conversão (visitante → cadastro, pedidos via agente) fica de fora.
- **Acesso a dados:** sessão do admin + policies de RLS + Realtime pela mesma
  sessão. Descartados:
  - chave de serviço no admin com polling: põe uma chave que ignora a RLS
    num app que não a tem, e não é ao vivo;
  - Realtime com liberação só de `id`/`conversation_id` (padrão do Hub
    Comercial): com o signup aberto, qualquer pessoa cadastrada veria a
    existência e o volume das conversas.
- **Só leitura:** o painel não altera nada.

## Banco (migration nova)

### Leitura para administradores

Para `agent_conversations`, `agent_messages` e `agent_events`:

```sql
grant select on public.<tabela> to authenticated;
create policy <tabela>_admin_select on public.<tabela>
  for select to authenticated
  using (exists (select 1 from public.admin_users where id = auth.uid()));
```

- Sem insert, update ou delete para `authenticated`. Quem grava continua
  sendo só o servidor do agente (service role).
- `anon` continua sem acesso nenhum.
- `authenticated` fora de `admin_users` recebe zero linhas.

### Realtime

```sql
alter publication supabase_realtime
  add table public.agent_conversations, public.agent_messages, public.agent_events;
```

O Realtime (`postgres_changes`) aplica a RLS de cada assinante: só
administradores recebem eventos. A migration precisa ser idempotente:
adiciona cada tabela só se ainda não estiver na publicação.

### View `v_agent_conversation_summary`

`with (security_invoker = true)`, para valer a RLS de quem consulta. Uma
linha por conversa:

| coluna | origem |
|---|---|
| `id`, `channel`, `started_as`, `buyer_id`, `created_at`, `updated_at` | `agent_conversations` |
| `empresa` | `buyers.empresa` (left join) |
| `message_count` | `count(agent_messages)` |
| `first_question` | `content` da primeira mensagem `user`, até 160 caracteres |
| `became_client` | existe mensagem com `mode = 'cliente'` numa conversa iniciada como `visitante` |
| `failure_count` | `count(agent_events)` com `kind in ('provider_error','aborted','empty_reply')` |
| `order_number`, `order_status` | pedido mais recente em `orders` com `agent_conversation_id = id` |

`buyers` e `orders` já têm policies de leitura para administradores, então o
join funciona com `security_invoker`.

### Função `agent_dashboard_indicators(p_channel text, p_since timestamptz, p_mode text)`

`language sql stable security invoker`. `p_mode` nulo = todos os modos.
Devolve uma linha:

| campo | definição |
|---|---|
| `conversations` | conversas com `updated_at >= p_since` |
| `failures` | eventos `provider_error`, `aborted` e `empty_reply` desde `p_since` |
| `fallbacks` | eventos `provider_fallback` desde `p_since` |
| `quota_blocks` | eventos `quota_blocked` desde `p_since` |
| `avg_first_token_ms` | média de `first_token_ms` das mensagens `assistant` desde `p_since` |
| `usage` | `jsonb`: `[{ model, input_tokens, output_tokens }]` somados por modelo, das mensagens `assistant` desde `p_since` |

Filtro de modo:
- nas conversas, por `started_as`;
- nos eventos e mensagens, pela coluna `mode`.

`grant execute ... to authenticated`. Como é `security invoker`, quem não
está em `admin_users` recebe zeros.

## Admin

### Arquivos

| arquivo | responsabilidade |
|---|---|
| `apps/admin/lib/agent-dashboard.ts` | lógica pura: filtros da URL, selo ao vivo, linha do tempo, descrição de ferramentas, custo |
| `apps/admin/lib/agent-dashboard.test.ts` | testes da lógica |
| `apps/admin/lib/agent-pricing.ts` | tabela de preços por modelo e `estimateCostUsd` |
| `apps/admin/lib/agent-pricing.test.ts` | testes do custo |
| `apps/admin/app/(dashboard)/agente/page.tsx` | lista + indicadores |
| `apps/admin/app/(dashboard)/agente/[id]/page.tsx` | conversa |
| `apps/admin/app/(dashboard)/agente/live-refresh.tsx` | componente cliente do Realtime |
| `apps/admin/app/(dashboard)/layout.tsx` | item "Conversas do agente" no menu |

Antes de escrever código, ler o guia relevante em
`node_modules/next/dist/docs/` (Next 16, regra do `AGENTS.md`).

### Filtros (`/agente?periodo=&modo=&falhas=`)

- `periodo`: `hoje` (padrão; desde 00:00 de São Paulo), `7d` ou `30d`.
- `modo`: vazio (todos), `visitante` ou `cliente`.
- `falhas=1`: só conversas com `failure_count > 0`.
- Canal fixo `mypetbrasil` (único com agente hoje), passado à view e à função.
- Valores inválidos caem no padrão.

### Lista `/agente`

- **Indicadores** da função:
  - *Volume e ao vivo:* conversas, conversando agora, aguardando resposta;
  - *Saúde da IA:* falhas, trocas de provedor, bloqueios por cota;
  - *Velocidade e custo:* tempo médio até a primeira resposta (em segundos,
    1 casa), tokens de entrada e saída, custo estimado em US$ (2 casas, com
    a palavra "estimativa").
- **Tabela** com até 100 conversas do período, por `updated_at desc`. Colunas:
  - selo;
  - início e última atividade (horário de São Paulo);
  - quem: empresa, ou "Visitante", ou "Cliente sem empresa";
  - modo, com "virou cliente" quando `became_client`;
  - mensagens;
  - primeira pergunta;
  - pedido (`#número`);
  - falhas.
- Cada linha leva a `/agente/[id]`.

### Selo ao vivo

- **conversando agora:** `updated_at` nos últimos 5 minutos.
- **aguardando resposta:** existe `turn_started` da conversa nos últimos 60
  segundos sem fechamento depois dele. Fecham o turno:
  - a mensagem `user` com o mesmo `message_id` (`detail.message_id`) em
    `agent_messages`;
  - um evento terminal (`provider_error`, `aborted`, `empty_reply`) mais novo.
- "aguardando" tem precedência sobre "conversando agora".
- Um `provider_error` de configuração (`detail.failures[0].provider =
  "config"`) não tem `turn_started` antes: não abre turno.
- "Conversando agora" e "aguardando resposta" do topo contam as conversas
  com cada selo, independentemente do filtro de período.

A lista busca os `turn_started` dos últimos 60 segundos e seus fechamentos
numa consulta à parte, e calcula o selo em `agent-dashboard.ts`.

### Conversa `/agente/[id]`

- **Cabeçalho:**
  - quem;
  - início;
  - modo inicial, e "virou cliente" quando for o caso;
  - pedido ligado, com número, status e total, usando o cálculo de total já
    existente em `apps/admin/lib/orders.ts`.
- **Linha do tempo**, juntando mensagens e eventos (exceto `turn_started`) por
  `created_at`:
  - pergunta (à direita) e resposta (à esquerda), com o texto das partes
    `text`;
  - abaixo de cada resposta, uma linha discreta: provedor · modelo · latência
    total · tokens entrada/saída · custo estimado. Campos nulos (mensagens de
    antes da especificação A) são omitidos;
  - partes de ferramenta (`type` começando com `tool-`) num `<details>`
    recolhido:
    - título por ferramenta: `buscar_produtos` → "Buscou produtos: '<query>'
      → N resultados"; `alterar_pedido` → "Alterou o pedido";
      `sugerir_reposicao` → "Sugeriu reposição"; `status_pedidos` →
      "Consultou pedidos"; outra → o nome da ferramenta;
    - ao expandir, a entrada e a saída em JSON formatado;
  - eventos de falha, troca de provedor, cota, conversa proibida e duplicada
    como linhas de sistema (falhas em vermelho), com o motivo (`detail`) e a
    pergunta;
  - "aguardando resposta…" no fim enquanto o turno estiver aberto (mesma
    regra do selo).
- Conversa inexistente ou sem permissão: `notFound()`.

### Ao vivo (`live-refresh.tsx`)

- Recebe do Server Component a URL e a chave pública do Supabase como props
  (a chave é pública; não exige variável de ambiente nova na Vercel), e
  opcionalmente um `conversationId`.
- Cria o cliente com `createBrowserClient` do `@supabase/ssr`, que usa a
  sessão dos cookies do login.
- Assina `postgres_changes` (`INSERT`/`UPDATE`) nas três tabelas. Na
  conversa, filtra por `id`/`conversation_id`.
- A cada evento, agenda `router.refresh()` com agrupamento de 1 segundo.
- Aba em segundo plano: não recarrega; marca pendente e recarrega ao voltar
  (`visibilitychange`).
- Com o prop `hasLive` verdadeiro (há selo na tela), recarrega também a cada
  30 segundos, para os selos expirarem.
- Falha na assinatura (`CHANNEL_ERROR`/`TIMED_OUT`): mostra "Atualização ao
  vivo indisponível" e recarrega a cada 30 segundos.

### Custo (`agent-pricing.ts`)

Preço em US$ por milhão de tokens (entrada/saída), conferido em 2026-10-17
nas páginas de preço dos provedores durante a implementação:

| modelo | entrada | saída |
|---|---|---|
| `gpt-4o-mini` | 0,15 | 0,60 |
| `gemini-2.5-flash` | 0,30 | 2,50 |
| `claude-haiku-4-5` | 1,00 | 5,00 |

`estimateCostUsd(model, inputTokens, outputTokens)` devolve `null` para
modelo fora da tabela, e a tela mostra "sem preço". Se um preço da tabela
divergir da página oficial na implementação, vale a página oficial.

## Tratamento de falhas

- Erro de consulta: mensagem vermelha, como em Pedidos
  ("Erro ao carregar conversas: …").
- Realtime indisponível: aviso + recarga periódica (acima).
- O painel nunca escreve no banco.

## Testes

- `agent-dashboard.test.ts`:
  - filtros: padrão, valores inválidos e o início do dia em São Paulo;
  - selo:
    - turno aberto vira "aguardando";
    - turno fechado por mensagem `user` ou por evento terminal não vira;
    - `turn_started` com mais de 60 s não conta;
    - "conversando agora" dentro e fora dos 5 minutos;
    - precedência de "aguardando";
  - linha do tempo: ordem, `turn_started` omitido e falhas incluídas;
  - descrição de cada ferramenta conhecida e de uma desconhecida.
- `agent-pricing.test.ts`: custo de cada modelo e modelo desconhecido →
  `null`.
- Verificação da migration no banco (no plano):
  - simular um `authenticated` fora de `admin_users` (`set local role` +
    `request.jwt.claims`): zero linhas nas três tabelas e na view, e zeros
    na função;
  - um admin lê;
  - `anon` sem privilégio;
  - as três tabelas em `pg_publication_tables` de `supabase_realtime`.

## Implantação

1. Aplicar a migration no hub_catalogo e rodar a verificação.
2. Deploy do `apps/admin`. Na ordem inversa, o painel mostraria erro de
   permissão até a migration entrar, sem afetar o agente.
3. Abrir `/agente` no admin, fazer uma pergunta no `/agente` do site e ver a
   conversa aparecer sem recarregar a página.

## Fora de escopo

- Conversão (visitante → cadastro, pedidos via agente) como indicador.
- Ações sobre a conversa (o painel é só leitura).
- Exportação CSV.
- Outros canais além de `mypetbrasil`.
- Pendência separada: `public.is_admin_or_editor()` aceita o papel vindo de
  `user_metadata`, que o próprio usuário define no signup (aberto). Precisa
  ser corrigida à parte; este painel não a usa.
