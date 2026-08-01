# Identidade do comprador e pedidos persistidos — Spec de Design

## Contexto

Hoje a "cotação" (`app/cotacao`, `packages/core/src/cart.ts`, `cart-provider.tsx`)
funciona assim: o carrinho vive só em `localStorage`, o lojista preenche
nome/empresa/whatsapp/cnpj ao finalizar, isso grava um `lead` na tabela `leads`
do Supabase `hub_catalogo`, e os itens do carrinho **nunca são persistidos** —
viram apenas texto de uma mensagem de WhatsApp (`buildQuoteMessage`) aberta via
link `wa.me`, fora do controle do sistema. Não existe conta de comprador, sessão,
nem qualquer forma de o lojista ver pedidos anteriores.

Este documento especifica a fundação para transformar isso num modelo mais
próximo de e-commerce: identidade leve do comprador (sem senha) e pedidos
gravados com status, servindo de base para trabalho futuro (histórico de
compras já incluso aqui; reviews/avaliações de produto ficam para uma spec
separada, pois dependem de pedido com status `entregue`).

Não existe integração de WhatsApp Business API no projeto (só links `wa.me`
client-side) — o servidor não consegue enviar mensagens proativas. Por isso a
verificação de identidade usa e-mail (novo canal, via Resend), não WhatsApp.

## Decisões

- **Autenticação sem senha**: magic link por e-mail. Sem OTP por WhatsApp
  (exigiria WhatsApp Business API, fora de escopo) e sem senha tradicional.
- **Novo campo obrigatório**: e-mail passa a ser exigido no formulário de
  finalização de cotação, em `mypet` e `distribuidora` (os dois apps que
  compartilham esse fluxo via `packages/core`). `azpetshop` não tem fluxo de
  cotação/carrinho hoje e fica fora de escopo.
- **Mecanismo de magic link: Supabase Auth**, reaproveitando o padrão já usado
  em `apps/admin` (`@supabase/ssr`, `supabase.auth.signInWithOtp`). Buyers
  viram usuários do Supabase Auth (`auth.users`); nenhuma tabela própria de
  token/hash/expiração é criada — o Supabase Auth já cobre geração, expiração
  e uso único do link. Envio do e-mail continua saindo pelo Resend, configurado
  como SMTP customizado do projeto Supabase (painel do Supabase, fora deste
  repositório).
- **`leads` continua existindo** sem alteração de schema — permanece o canal de
  captura de interesse genérico (ex.: quem preenche o modal de cotação rápida
  de 1 produto via `LeadGateProvider`, que não muda nesta spec). `buyers` é uma
  tabela nova e independente, específica de quem passa pelo checkout do
  carrinho.
- **Fechamento do pedido continua manual**: gravar o pedido não substitui a
  negociação por WhatsApp/telefone (preço, forma de pagamento, prazo). Sem
  gateway de pagamento nesta spec.
- **Carrinho anônimo**: navegação e montagem do carrinho continuam 100% em
  `localStorage`, sem exigir identidade — a autenticação só entra no momento de
  finalizar.
- **Sessão**: cookie `httpOnly`, `Secure`, `SameSite=Lax`, validade de 60 dias,
  identificando o `buyer_id`. Sem refresh silencioso — expirado, pede novo
  magic link.

## Arquitetura

### Modelo de dados (Supabase `hub_catalogo`, gerenciado fora do repo)

```sql
-- Perfil do comprador, 1:1 com um usuário do Supabase Auth (auth.users).
-- Mesmo padrão de admin_users vinculado a auth.users em apps/admin.
buyers (
  id            uuid primary key references auth.users(id),
  email         text not null unique,
  nome          text not null,
  empresa       text not null,
  whatsapp      text not null,
  cnpj          text,
  created_at    timestamptz not null default now()
)

orders (
  id            uuid primary key default gen_random_uuid(),
  buyer_id      uuid not null references buyers(id),
  channel       text not null,        -- 'mypetbrasil' | 'distribuidora'
  status        text not null default 'pendente', -- pendente|confirmado|entregue|cancelado
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
)

order_items (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references orders(id),
  product_id            uuid not null references products(id),
  product_name_snapshot text not null,
  qty                   integer not null check (qty > 0)
)
```

`product_name_snapshot` garante que o histórico continue legível mesmo se o
produto for renomeado ou removido do catálogo depois.

`buyers.id` é o mesmo `id` do usuário em `auth.users` — não um novo UUID
próprio. Um trigger (gerenciado fora do repo, no painel do Supabase, igual ao
resto do schema) ou o próprio código de callback de login (Task 4) cria a
linha em `buyers` no primeiro acesso, mesmo padrão do relacionamento
`admin_users` ↔ `auth.users` já usado no admin.

### Fluxo de autenticação (magic link via Supabase Auth)

1. Lojista aciona login (explicitamente, ou implicitamente ao finalizar
   cotação sem sessão ativa) e informa e-mail num formulário mínimo.
2. Client component chama `supabase.auth.signInWithOtp({ email, options: {
   emailRedirectTo: "https://<app>/entrar/callback" } })` — usando um
   `createBrowserSupabaseClient` novo em `packages/core` (mesmo par
   url/anonKey de `getHubClient`, mas com `@supabase/ssr` para
   compartilhar sessão via cookie, como o admin já faz no servidor).
   O Supabase Auth cuida de gerar o link, expiração e uso único; não há
   tabela ou lógica de token própria neste projeto.
   Resposta da UI é sempre a mesma mensagem de sucesso
   ("Verifique seu e-mail"), com ou sem erro do Supabase, para não expor se o
   e-mail existe.
3. Lojista abre o e-mail (enviado pelo Supabase Auth, via SMTP customizado do
   Resend configurado no projeto Supabase — configuração de painel, fora
   deste repositório) e clica no link, que aponta para `/entrar/callback`.
4. `/entrar/callback` (route handler) troca o código pela sessão via
   `supabase.auth.exchangeCodeForSession`, o que já grava os cookies de
   sessão através do `createServerSupabaseClient` (Task 3). Depois:
   - Verifica se já existe linha em `buyers` para aquele `user.id`. Se não
     existe (primeiro acesso), redireciona para `/completar-cadastro`, que
     pede nome/empresa/whatsapp/cnpj (mesmos campos do formulário de cotação
     atual) e grava a linha em `buyers` antes de liberar o resto do site.
   - Se já existe, redireciona direto para `/cotacao` (ou para onde a
     jornada começou).
5. Link inválido/expirado/já usado → o próprio Supabase Auth retorna erro na
   troca de código; a página de callback mostra erro com botão "Pedir novo
   link" (reabre o passo 1).

O carrinho em `localStorage` não é afetado por esse fluxo: como o magic link é
aberto no mesmo navegador que iniciou o checkout (é o padrão esperado — quem
finaliza a cotação abre o próprio e-mail no mesmo aparelho), o carrinho
continua lá quando a sessão é criada e o usuário volta para `/cotacao`. Se o
link for aberto em outro dispositivo, a sessão é criada normalmente, mas o
carrinho daquele dispositivo pode estar vazio — comportamento aceito (mesma
limitação que qualquer carrinho local-first tem).

### Fluxo de checkout (`/cotacao`)

1. Lojista monta o carrinho normalmente (sem mudança).
2. Ao clicar "Finalizar cotação":
   - **Sem sessão**: mostra o formulário de e-mail (passo 1 da autenticação)
     em vez do formulário atual de nome/empresa/whatsapp/cnpj. Fluxo de magic
     link roda; ao voltar autenticado, a página retoma o checkout.
   - **Com sessão**: segue direto para confirmação, usando os dados já
     salvos em `buyers` (sem pedir nome/empresa/whatsapp/cnpj de novo).
3. Confirmação grava `orders` (status `pendente`, `channel` do app atual) +
   um `order_items` por item do carrinho, com `product_name_snapshot`.
4. Só então monta a mensagem via `buildQuoteMessage` (sem mudança de formato)
   e abre o link `wa.me`, como hoje.
5. Limpa o carrinho local e mostra confirmação, incluindo link para
   `/pedidos` (novo).

### Histórico de compras (`/pedidos`)

Página autenticada (redireciona para login se não há sessão) listando os
`orders` do `buyer_id` da sessão, mais recentes primeiro: data, status,
itens (nome + qty). Sem paginação complexa no MVP — volume esperado é baixo
por comprador.

### Admin (`apps/admin`)

- Nova seção `Pedidos`, mesmo padrão de `apps/admin/app/(dashboard)/clientes/`:
  lista `orders` com filtro por canal e status, join com `buyers` para mostrar
  nome/empresa/whatsapp, e itens expandíveis.
- `status-select.tsx` existente (usado hoje em `leads.status`) é reaproveitado
  como componente genérico para `orders.status`, com os valores
  `pendente/confirmado/entregue/cancelado`.
- Exportação CSV segue o mesmo padrão de `clientes/export/route.ts`.

## Erros e casos-limite

| Caso | Comportamento |
| --- | --- |
| Resend/Supabase Auth fora do ar / e-mail não envia | Erro genérico no formulário (mesmo padrão de `GENERIC_SERVER_ERROR` em `leads.ts`), sem expor detalhe técnico |
| Link expirado (padrão Supabase Auth) | Callback recebe erro do Supabase; página mostra CTA "Pedir novo link" |
| Link já usado (reuso de link antigo) | Mesmo comportamento — erro do Supabase na troca de código, mesma página de erro |
| E-mail digitado não bate com nenhuma conta | `signInWithOtp` cria a conta no primeiro envio (comportamento padrão do Supabase Auth) — não há distinção de "e-mail inexistente"; a UI sempre mostra a mesma mensagem de sucesso |
| Pedido de magic link em excesso | Rate limit já é aplicado pelo Supabase Auth por padrão; sem lógica própria neste projeto |
| Produto do pedido removido do catálogo depois | Histórico usa `product_name_snapshot`, continua exibível; sem link ativo para a PDP |
| Sessão expira em produção | Tratado como "sem sessão": checkout ou `/pedidos` disparam novo magic link |

## Testes

Seguindo o padrão já estabelecido (`*.test.ts` ao lado do código, funções
puras testadas isoladamente):

- `buyers-server.test.ts` — criação da linha em `buyers` no primeiro acesso
  (callback de login) vs. reconhecimento em acessos seguintes pelo mesmo
  `user.id`, com o client do Supabase mockado (mesmo padrão de
  `leads-server.test.ts`).
- `orders.test.ts` — criação de `order` + `order_items` com snapshot correto
  a partir do carrinho.
- Fluxo ponta a ponta (manual via `/run`): checkout sem sessão → pedir link →
  abrir link (simulado) → carrinho intacto → confirmar → item aparece em
  `/pedidos` e no admin com status `pendente`; admin muda status →
  `/pedidos` reflete a mudança.
- `npm run build` e `npm run lint` continuam como critério de aceite.

## Fora de escopo

- Reviews e avaliações de produto (spec futura, depende de `orders.status =
  'entregue'` definido aqui).
- Pagamento online (cartão/boleto/Pix) — pedido continua sendo fechado por
  negociação manual.
- Integração de WhatsApp Business API (envio automático de mensagens).
- `apps/azpetshop` — não tem fluxo de carrinho/cotação hoje.
- Login "tradicional" com senha, redefinição de senha, 2FA.
- Configuração de domínio/DNS real do Resend em produção (fica um passo
  manual documentado, como já é o caso do número de WhatsApp).
- Merge de carrinho entre dispositivos diferentes.
