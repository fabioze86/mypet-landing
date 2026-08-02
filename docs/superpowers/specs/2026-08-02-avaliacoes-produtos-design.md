# Avaliações de produtos (reviews) — Spec de Design

## Contexto

A fundação de [[2026-07-31-identidade-pedidos-design]] já está em produção:
lojista tem identidade (magic link por e-mail, `buyers`), carrinho vira pedido
persistido (`orders`/`order_items`) e o admin avança status
(`pendente → confirmado → entregue → cancelado`, `apps/admin/app/(dashboard)/pedidos`).

Este documento especifica a última camada do roadmap desenhado naquela sessão:
avaliações de produto por lojistas que efetivamente compraram. Cobre as 4
partes discutidas — convite automático, formulário de avaliação, moderação e
exibição na PDP — numa spec só, fatiada em fases no plano de implementação.

Como no caso da identidade, **não existe WhatsApp Business API** no projeto
(só links `wa.me` client-side), então o convite de avaliação sai por e-mail,
reaproveitando o Resend já decidido na spec de identidade/pedidos.

Referência de boas práticas levantada na sessão anterior (Amazon, Mercado
Livre, Chewy): verified purchase como driver de confiança, avaliação por
produto (não por pedido genérico), nota + distribuição de estrelas, moderação
antes de publicar, e evitar incentivo pago por nota positiva.

## Decisões

- **Convite por e-mail via Resend**, disparado quando o admin muda o status de
  um pedido para `entregue` (não há automação por WhatsApp — mesma limitação
  já documentada na spec de identidade). Só dispara na transição *para*
  `entregue`; mudar de `entregue` para outro status e voltar não reenvia.
- **Token próprio, sem exigir login**: o link do e-mail carrega um token de
  acesso ao pedido (`review_invite_tokens`), não reaproveita o magic link de
  sessão. Menor fricção pro lojista, ao custo de uma tabela de token dedicada.
- **Avaliação por item do pedido**, não por pedido inteiro — alimenta nota por
  produto na PDP, que é o que a Amazon/ML fazem. Um pedido com 3 produtos
  gera até 3 avaliações independentes.
- **Aprovação obrigatória antes de publicar**: toda avaliação nasce
  `pendente` e só aparece na PDP depois de aprovada no admin.
- **Upload de 1 foto opcional por avaliação**, via Cloudflare Images —
  reaproveita a integração já existente em `apps/admin/lib/cloudflare-images.ts`
  (hoje usada só pra banners de marketing), movida para `packages/core` pra
  ficar acessível também em `mypet` e `distribuidora`.
- **Sem rate-limit adicional**: a constraint única em `order_item_id` já
  impede duas avaliações para o mesmo item comprado.
- **Escopo de canais**: `mypet` e `distribuidora`, mesmo padrão da spec
  anterior. `azpetshop` não tem fluxo de pedido/carrinho e fica de fora.

## Arquitetura

### Modelo de dados (Supabase `hub_catalogo`, gerenciado fora do repo)

**`product_reviews`** (nova)
- `id` (uuid, pk)
- `order_id` (uuid, fk `orders.id`)
- `order_item_id` (uuid, fk `order_items.id`, **unique** — 1 review por item comprado)
- `product_id` (uuid, fk `products.id` — denormalizado do item pra consulta direta na PDP)
- `buyer_id` (uuid, fk `buyers.id`)
- `rating` (smallint, 1 a 5, `check (rating between 1 and 5)`)
- `comment` (text, nullable)
- `photo_url` (text, nullable)
- `status` (text, `'pendente' | 'aprovado' | 'rejeitado'`, default `'pendente'`)
- `created_at` (timestamptz, default `now()`)
- `moderated_at` (timestamptz, nullable)

**`review_invite_tokens`** (nova)
- `id` (uuid, pk)
- `order_id` (uuid, fk `orders.id`)
- `token` (text, unique, aleatório — ex. `crypto.randomUUID()` ou equivalente)
- `expires_at` (timestamptz, `created_at + 30 dias`)
- `created_at` (timestamptz, default `now()`)

Sem RLS coberta por sessão (o token não é um usuário autenticado) — o acesso
ao formulário de avaliação valida o token manualmente no server (rota busca
com `service role` / mesmo padrão já usado nas outras `*-server.ts` do core),
não depende de política de RLS por `auth.uid()`.

### Fluxo de convite (`packages/core/src/review-invites-server.ts`, novo)

1. `updateOrderStatus` (`apps/admin/app/(dashboard)/pedidos/actions.ts`) lê o
   status atual do pedido antes de atualizar.
2. Se `status atual !== "entregue"` e `novo status === "entregue"`:
   - gera token, insere em `review_invite_tokens`;
   - busca e-mail do `buyer` do pedido;
   - chama `sendReviewInviteEmail(buyer.email, orderId, token, channel)`
     (nova função em `packages/core`, usa Resend, mesmo `RESEND_API_KEY`/
     domínio remetente configurados na spec de identidade — variável já
     existe no ambiente do admin).
   - link do e-mail: `https://{domínio do canal}/avaliar/{token}`.
3. Falha no envio de e-mail é logada e não bloqueia a atualização de status
   (mesmo padrão de "melhor esforço" usado hoje pros outros side-effects).

### Formulário de avaliação (`/avaliar/[token]`, novo em `mypet` e `distribuidora`)

1. Rota pública (sem exigir sessão) busca `review_invite_tokens` pelo token.
   - Token inexistente ou expirado → página de erro ("link inválido ou
     expirado").
2. Busca o pedido (`order_id`) e seus itens (reaproveita o formato de
   `getOrdersByBuyer`/`OrderWithItems`, mas por `order_id` direto).
3. Pra cada item, verifica se já existe `product_reviews` com aquele
   `order_item_id`:
   - se sim, item aparece marcado como "já avaliado" (somente leitura);
   - se não, mostra formulário: nota (1-5 estrelas, obrigatório), comentário
     (texto livre, opcional), upload de foto (opcional, Cloudflare Images).
4. Envio grava `product_reviews` com `status: "pendente"`. Sem redirecionar
   pra fora da página — lojista pode avaliar os demais itens do mesmo pedido
   na sequência.

### Moderação (`apps/admin/app/(dashboard)/avaliacoes`, novo)

- Lista `product_reviews` com `status: "pendente"` primeiro (produto, nota,
  comentário, foto, nome do comprador/empresa, data), seguida das já
  moderadas.
- Duas server actions, mesmo padrão de `pedidos/actions.ts`:
  `approveReview(id)` → `status: "aprovado"`, `moderated_at: now()`.
  `rejectReview(id)` → `status: "rejeitado"`, `moderated_at: now()`.
- Rejeitadas continuam no banco (auditoria), somem da fila de pendentes.

### Exibição na PDP (`packages/core/src/components/product-reviews.tsx`, novo)

- Nova função `getProductReviews(productId, channel)` em
  `packages/core/src/catalog.ts` (ou arquivo próprio `reviews.ts`): retorna
  `product_reviews` com `status: "aprovado"` do produto, mais nota média e
  contagem.
- Componente `ProductReviews`, renderizado abaixo da descrição/especificações
  em `apps/mypet/app/produtos/[id]/page.tsx` e
  `apps/distribuidora/app/produtos/[id]/page.tsx`: nota média com estrelas,
  distribuição por nota (5★ x%, 4★ y%...), lista de comentários (mais
  recentes primeiro) com foto quando houver.
- Produto sem avaliação aprovada: seção não renderiza (sem placeholder "seja
  o primeiro a avaliar" — fora de escopo).

## Erros e casos-limite

- **Token expirado/inválido**: página de erro simples, sem vazar se o token
  existiu (evita enumeração), mesmo princípio já aplicado no `LoginForm`
  ([[2026-07-31-identidade-pedidos-design]]).
- **Pedido cancelado após convite enviado**: token já emitido continua válido
  tecnicamente, mas como o convite só é gerado na transição *para*
  `entregue`, esse caso exige que o admin tenha revertido o status depois —
  aceitável deixar o formulário funcionar (o item foi comprado e entregue de
  fato quando o convite saiu).
- **Reenvio de review pro mesmo item**: bloqueado pela constraint única em
  `order_item_id`; formulário já esconde o campo pra item já avaliado.
- **Falha no upload da foto**: avaliação pode ser enviada sem foto (campo
  opcional); erro de upload não bloqueia envio de nota+comentário.
- **E-mail do buyer inválido/bounce**: falha fica só em log; sem fila de
  retry nesta versão (mesmo tratamento "melhor esforço" da spec anterior).

## Testes

- `review-invites-server.test.ts`: geração de token, cálculo de expiração,
  chamada de envio de e-mail (mock do client Resend).
- `product_reviews`/formulário: validação de token expirado/inválido, bloqueio
  de reenvio pro mesmo `order_item_id`, gravação com `status: "pendente"`.
- Moderação: `approveReview`/`rejectReview` atualizam `status` e
  `moderated_at` corretamente.
- `getProductReviews`: só retorna `status: "aprovado"`, cálculo de nota
  média e distribuição corretos.
- Cobertura de `cloudflare-images.ts` movido pra `packages/core` já existe
  (`apps/admin/lib/cloudflare-images.test.ts`) — migra junto.

## Fora de escopo

- Resposta pública da marca/vendedor a uma avaliação.
- Voto "isso foi útil?" em avaliações.
- Mais de 1 foto por avaliação, ou vídeo.
- Reenvio automático do convite (ex. lembrete se não avaliou em X dias).
- Detecção automática de fraude além da constraint de unicidade (ex. NLP
  pra padrões suspeitos, mencionado na pesquisa original mas fora desta
  primeira versão).
- Exibição de avaliação em destaque na busca/listagem de produtos (só na PDP
  nesta versão).
