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
- **Provedor de e-mail**: Resend.
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
buyers (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  nome          text not null,
  empresa       text not null,
  whatsapp      text not null,
  cnpj          text,
  created_at    timestamptz not null default now()
)

auth_tokens (
  id            uuid primary key default gen_random_uuid(),
  buyer_id      uuid not null references buyers(id),
  token_hash    text not null,        -- hash do token, nunca o valor puro
  expires_at    timestamptz not null, -- created_at + 15 minutos
  used_at       timestamptz,
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

O token em `auth_tokens` é gerado com alta entropia (ex.: 32 bytes aleatórios,
`crypto.randomBytes`) e só o hash (SHA-256) é armazenado — o valor puro vai
apenas no link do e-mail, igual a um reset de senha tradicional.

### Fluxo de autenticação (magic link)

1. Lojista aciona login (explicitamente, ou implicitamente ao finalizar
   cotação sem sessão ativa) e informa e-mail num formulário mínimo.
2. `POST /api/auth/request-link`:
   - Busca `buyers` por e-mail. Se não existe, **não cria ainda** — cadastro
     completo (nome/empresa/whatsapp/cnpj) só é pedido depois de confirmar o
     e-mail, para não gravar registros de e-mails digitados errado.
   - Gera token, grava `auth_tokens` (hash), envia e-mail via Resend com link
     `https://<app>/entrar/<token>`.
   - Resposta sempre genérica de sucesso ("Se o e-mail for válido, você
     receberá um link"), independentemente de existir conta — evita
     enumeração de e-mails cadastrados.
   - Rate limit por e-mail e por IP (ex.: 3 pedidos / 10 min) para não virar
     vetor de spam de caixa de entrada de terceiros.
3. Lojista abre o e-mail e clica no link. `GET /entrar/[token]`:
   - Valida hash, não expirado, não usado.
   - Se `buyers` já existe para aquele token → cria sessão (cookie) e
     redireciona para `/cotacao` (ou para onde a jornada começou).
   - Se é o primeiro acesso daquele e-mail → mostra formulário curto
     (nome/empresa/whatsapp/cnpj, mesmos campos do formulário de cotação
     atual) para completar o cadastro antes de criar a sessão.
   - Marca `used_at` no token (uso único).
4. Token inválido/expirado/já usado → página de erro com botão "Pedir novo
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
| Resend fora do ar / e-mail não envia | Erro genérico no formulário (mesmo padrão de `GENERIC_SERVER_ERROR` em `leads.ts`), sem expor detalhe técnico |
| Token expirado (>15 min) | Página de erro com CTA "Pedir novo link" |
| Token já usado (reuso de link antigo) | Mesma página de erro que expirado |
| E-mail digitado não bate com nenhuma conta | Resposta idêntica à de sucesso (anti-enumeração); ao clicar no link (que nunca chega, pois o e-mail é inválido), nada acontece — comportamento esperado |
| Pedido de magic link em excesso | Rate limit por e-mail/IP retorna erro de "tente novamente mais tarde" |
| Produto do pedido removido do catálogo depois | Histórico usa `product_name_snapshot`, continua exibível; sem link ativo para a PDP |
| Sessão expira em produção | Tratado como "sem sessão": checkout ou `/pedidos` disparam novo magic link |

## Testes

Seguindo o padrão já estabelecido (`*.test.ts` ao lado do código, funções
puras testadas isoladamente):

- `auth.test.ts` — geração/validação de token (válido, expirado, usado,
  inexistente); hash nunca compara o valor puro.
- `buyers.test.ts` — criação no primeiro acesso vs. reconhecimento por e-mail
  em acessos seguintes.
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
