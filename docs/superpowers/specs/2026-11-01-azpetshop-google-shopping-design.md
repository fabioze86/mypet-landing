# AZ Pet Shop no Google Shopping — Design

- **Data:** 2026-11-01
- **Repo:** `mypet-landing` (app `apps/azpetshop`, pacote `packages/core`, app `apps/admin`)
- **Loja:** `www.azpetshop.com.br` (Next.js na Vercel, catálogo do Supabase `hub_catalogo`, canal `azpetshop`)

## Contexto

A loja hoje converte por **cotação no WhatsApp**: carrinho no navegador → nome + WhatsApp →
mensagem pré-preenchida, sem preço final nem pagamento. O Google Merchant Center exige que o
produto seja comprável na página de destino, então esse modelo não serve para Google Shopping.
Esta entrega transforma a loja em e-commerce com checkout real e a publica no Google.

### Diagnóstico do catálogo (hub, 2026-11-01)

| Produtos do canal `azpetshop` | Qtd |
|---|---|
| Vinculados (`product_channel_links`) | 590 |
| Com preço de varejo (`product_channel_prices.sale_price > 0`) | 375 |
| Com estoque (`products.stock_qty > 0`) | 454 |
| Com GTIN (`products.barcode`) | 590 |
| Com peso (`weight_kg > 0`) | 9 |
| Com dimensões (`width_cm/height_cm/length_cm > 0`) | 0 |

`product_channel_links.is_active` não é usado pela loja (resíduo da sincronização MKX) e não
entra em nenhum critério desta entrega.

## Decisões validadas com o usuário

1. **Checkout real no site** (não link de pagamento). **A forma de finalizar é escolha por site**,
   via nova feature `checkout` em `packages/core/src/features.ts`: `whatsapp` (cotação atual),
   `online` (pagamento Asaas) ou `ambos` (os dois botões no carrinho). A azpetshop usa `ambos`;
   os demais sites ficam em `whatsapp` (comportamento atual). Google Shopping exige `online` ou `ambos`.
2. **Frete via Melhor Envio** (API de cotação; etiqueta gerada à mão no painel do Melhor Envio).
   O produto sai do mesmo estoque/endereço da My Pet (`stock_qty` do hub é compartilhado).
3. **Pagamento via Asaas, checkout hospedado**: o site cria a cobrança pela API e redireciona o
   cliente à página de pagamento do Asaas (Pix e cartão parcelado). Dados de cartão nunca passam
   pelo nosso servidor.
4. **Pedidos no Supabase** com aviso por WhatsApp/e-mail à equipe e tela no admin. NF-e emitida
   à mão no sistema fiscal atual.
5. **Compra como convidado**: sem contas de cliente.
6. **Vendedor oficial = mesmo CNPJ da My Pet / Grupo AZ**, nome fantasia "AZ Pet Shop".
7. **Feed = todos os produtos vinculados ao canal que têm preço**, com ou sem estoque.
8. **No site, todo produto vinculado continua aparecendo.** Sem preço → botão "Consultar preço no
   WhatsApp". Sem estoque → selo "Esgotado" + mesmo botão de consulta. (Comportamento assumido como
   padrão; o usuário pode ajustar.)
9. **Dados logísticos ficam por último**: até a fase 4, o frete é cotado com um **pacote padrão
   provisório** (caixa única e peso estimado, constantes no código).
10. Contas de Merchant Center e Google Ads começam do zero; criação é passo manual do usuário.

## Fases

| # | Fase | Depende de |
|---|---|---|
| 1 | Conformidade da loja | — |
| 2 | Checkout e pedidos (pacote provisório) | 1 (botão "Comprar" e preço na PDP) |
| 3 | Feed e Google | 1 e 2 em produção |
| 4 | Dados logísticos | 2 |

Cada fase recebe seu próprio plano de implementação.

---

## Fase 1 — Conformidade da loja

**Dados da empresa** num único módulo, `apps/azpetshop/lib/empresa.ts`: razão social, nome
fantasia, CNPJ, endereço completo, e-mail, WhatsApp de atendimento, horário. Nesta fase usa
**valores genéricos de exemplo** (decisão do usuário); a troca pelos reais é bloqueante para o
deploy de produção e para o cadastro no Merchant Center. Rodapé, páginas de política e JSON-LD `Organization`
leem só daqui.

**Rodapé** da loja: dados da empresa, links das políticas, formas de pagamento (Pix, cartão).

**Páginas estáticas** (rascunho escrito por nós, revisão jurídica do usuário):
- `/politicas/troca-e-devolucao`: arrependimento em 7 dias (CDC art. 49), defeito, como solicitar.
- `/politicas/privacidade`: dados coletados no checkout, finalidade, LGPD, contato.
- `/politicas/entrega`: área atendida (Brasil), Melhor Envio, prazo exibido no checkout, rastreio.
- `/politicas/pagamento`: Pix e cartão via Asaas, parcelamento, prazo de confirmação.

**PDP e cards:** preço sempre visível quando existir; linha de parcelamento
"ou até Nx de R$ Y sem juros" calculada por regra configurável (número máximo de parcelas e
parcela mínima) em `lib/empresa.ts`. Botão "Comprar" (adiciona ao carrinho) para produto com preço
e estoque; regras de "Consultar preço" / "Esgotado" conforme decisão 8.

## Fase 2 — Checkout e pedidos

### Fluxo

1. Carrinho (provider atual do core) → `/checkout`.
2. **Dados do comprador:** nome, CPF (validado por `br-validation`), e-mail, WhatsApp.
3. **Entrega:** CEP → ViaCEP preenche endereço; número/complemento manuais. Servidor cota no
   Melhor Envio e exibe opções (serviço, preço, prazo); cliente escolhe uma.
4. **Resumo** (itens, subtotal, frete, total) → "Pagar".
5. Server action valida tudo de novo, **relê preços em `product_channel_prices`**, **recota o
   frete**, confere estoque > 0, grava o pedido (`aguardando_pagamento`), cria cliente + cobrança no
   Asaas e redireciona para a URL de pagamento do Asaas.
6. Asaas volta para `/pedido/[id]?t=<token>`, que mostra status, itens e entrega.
   O token (aleatório, gravado no pedido) impede que qualquer um veja pedidos alheios pelo id.
7. **Webhook** `/api/webhooks/asaas`: autenticado pelo header de token do Asaas, idempotente pelo
   id do evento. `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` → `pago`, baixa estoque e dispara avisos;
   `PAYMENT_OVERDUE`/cancelamento → `expirado`/`cancelado`.

A cotação por WhatsApp **não é removida**. Com `checkout: "ambos"`, o carrinho mostra
"Pagar agora" (vai para `/checkout`) e "Finalizar pelo WhatsApp" (fluxo atual de `/cotacao`).
Com `whatsapp`, só o segundo; com `online`, só o primeiro. A feature aparece no admin em
"funcionalidades", como `commerce`.

### Dados (migração no `hub_catalogo`)

- `orders` (existente, usada pela distribuidora) ganha colunas nulas para varejo:
  `customer_cpf`, `customer_email`, `subtotal`, `shipping_price`, `total`, `access_token`.
  `channel = 'azpetshop'`. Status do varejo:
  `aguardando_pagamento → pago → enviado → entregue`, ou `cancelado` / `expirado`.
- `order_items` (existente): `unit_price` gravado com o preço relido no servidor.
- **Nova `order_shipping`**: `order_id`, endereço (cep, logradouro, número, complemento, bairro,
  cidade, uf), `service_id`, `service_name`, `price`, `delivery_days`, `tracking_code`, `shipped_at`.
- **Nova `order_payments`**: `order_id`, `asaas_customer_id`, `asaas_payment_id`, `invoice_url`,
  `method`, `amount`, `status`, `last_event_id`, `last_event_payload` (jsonb), timestamps.
- RLS: escrita apenas via service role no servidor; nenhuma leitura anônima direta.

### Integrações (módulos novos no core, isolados e testáveis)

- `melhor-envio.ts`: `quoteShipping({ cepDestino, pacote, valorDeclarado })` → lista de opções.
  Pacote vem de `shippingPackageFor(items)`; na fase 2 retorna o **pacote padrão provisório**.
- `asaas.ts`: `ensureCustomer`, `createCharge` (Pix + cartão, parcelamento conforme regra),
  `verifyWebhook`.
- `retail-checkout-server.ts`: orquestra validação, recálculo, gravação e cobrança.

Credenciais em env vars (`ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `MELHOR_ENVIO_TOKEN`, CEP de
origem), sandbox em dev/preview, produção só no deploy de produção.

### Erros

- Falha na cotação de frete: mensagem "Não conseguimos calcular o frete agora" e opção de tentar
  de novo; não segue sem frete.
- Preço ou estoque mudou entre o carrinho e o pagamento: bloqueia, mostra o novo valor e pede
  confirmação.
- Falha ao criar a cobrança: pedido fica `aguardando_pagamento` sem cobrança e o usuário pode
  tentar de novo (reaproveita o mesmo pedido).
- Webhook repetido ou fora de ordem: ignorado se o evento já foi processado ou se rebaixaria o status.

### Operação

- Pedido pago → aviso à equipe (WhatsApp e e-mail) com número, itens, total e endereço; e-mail de
  confirmação ao cliente com o link `/pedido/[id]?t=...`.
- `admin/pedidos`: filtro por canal, detalhe com entrega e pagamento, campo de rastreio e ação
  "marcar enviado" (envia o rastreio ao cliente) e "marcar entregue".

## Fase 3 — Feed e Google

**Feed** `GET /feeds/google.xml` (RSS 2.0 com namespace `g:`), revalidado a cada poucas horas.
Itens: produtos vinculados ao canal **com preço > 0**, com ou sem estoque.

| Campo | Fonte |
|---|---|
| `g:id` | `products.reference` |
| `g:title` | `product_channel_links.title` → `products.name` |
| `g:description` | descrição do canal → mestre, sem HTML |
| `g:link` | URL da PDP |
| `g:image_link`, `g:additional_image_link` | `product_assets` |
| `g:price` | `product_channel_prices.sale_price` (mesma fonte de PDP e checkout) |
| `g:availability` | `stock_qty > 0` → `in_stock`, senão `out_of_stock` |
| `g:gtin` | `products.barcode` |
| `g:brand` | `products.brand` |
| `g:condition` | `new` |
| `g:google_product_category` | de-para fixo no código: nossa categoria → taxonomia Google |
| `g:product_type` | caminho da nossa categoria |
| `g:item_group_id` | `parent_product_id` quando for variação |

Produto sem imagem entra no feed e é reprovado no Merchant Center até ganhar imagem (visível no
diagnóstico do MC). Frete configurado **na conta do Merchant Center**, não por item.

**Consistência:** JSON-LD `Offer` da PDP com preço e disponibilidade idênticos ao feed.

**Medição:** eventos GA4 de e-commerce `view_item`, `add_to_cart`, `begin_checkout` e
`purchase` (este disparado na página do pedido quando o status é `pago`, uma vez por pedido) e
conversão "Compra" no Google Ads importada do GA4.

**Passos manuais do usuário (checklist):**
1. Criar o Merchant Center; verificar e reivindicar `www.azpetshop.com.br`.
2. Preencher dados da empresa, política de devolução e frete na conta.
3. Cadastrar o feed por URL com busca diária.
4. Ativar listagens gratuitas e acompanhar a aprovação.
5. Após os primeiros pedidos reais, criar o Google Ads ligado ao MC e uma campanha Performance Max
   (ou Shopping padrão) com orçamento baixo.

## Fase 4 — Dados logísticos

- Nova tabela `category_shipping_defaults` (`category_id`, `weight_kg`, `width_cm`, `height_cm`,
  `length_cm`).
- `shippingPackageFor(items)` passa a somar: medida do produto quando existir, senão padrão da
  categoria, senão pacote provisório.
- Admin: medidas padrão na edição de categoria, medidas na edição de produto, relatório
  "produtos sem medida".
- Opcional: `g:shipping_weight` no feed e frete por peso no Merchant Center.

## Testes

- Unitários (vitest, padrão do core): parcelamento, `shippingPackageFor`, montagem do XML do feed,
  de-para de categoria, validação do checkout, transições de status, idempotência do webhook.
- Clientes Asaas e Melhor Envio testados com `fetch` mockado; validação manual ponta a ponta em
  sandbox (Pix e cartão) antes do deploy.

## Fora de escopo

Checkout transparente, NF-e automática, etiqueta automática, cupons, avaliações
(`aggregateRating`), contas de cliente, Content API do Google.

## Pendências em aberto (registradas em 2026-11-01, após a fase 1)

Fase 1 entregue e enviada para a `main` (`f4c7d99..853bc57`). Itens abaixo ficam para resolução futura.

### Bloqueantes para produção (dono)
- [ ] **Dados reais da empresa** em `apps/azpetshop/lib/empresa.ts` (hoje "Empresa Exemplo Ltda", CNPJ de teste)
  e depois `DADOS_DE_EXEMPLO = false`. Enquanto for `true`, `next.config.ts` derruba o build com
  `VERCEL_ENV=production`, de propósito.
- [ ] **Confirmar a branch de produção da azpetshop na Vercel** e se o primeiro deploy após o push falhou pela trava.
- [ ] **Revisão jurídica das 4 políticas** (`apps/azpetshop/lib/politicas.ts`). Promessas a confirmar ou ajustar:
  reembolso incluindo o frete; 30 dias para defeito com devolução sem custo; estorno do Pix em 5 dias úteis;
  código de postagem reversa; NF-e em todo pedido; cancelamento automático do Pix não pago; texto
  "Asaas, instituição de pagamento autorizada pelo Banco Central"; parcelamento sem juros (até 6x, parcela mínima R$ 30).
- [ ] **Afirmações restantes na home** (`apps/azpetshop/app/page.tsx`): "até 25% OFF" e "Ver ofertas da semana"
  (maior risco no Merchant Center), "entregue rapidinho", "bipou, chegou!", "Petiscos naturais".
- [ ] **Banner de consentimento de cookies** (GA4 ativo sem consentimento; risco LGPD).
- [ ] **Conferência visual** em 375px e 1280px: home, card sem preço, card esgotado, PDP com parcelamento,
  produto com variações, políticas, rodapé (possível emenda de cor entre o fundo do body e o rodapé).

### Para as próximas fases
- [x] **Fase 2:** feature `checkout` (`whatsapp` | `online` | `ambos`) por site; azpetshop = `ambos`.
  As promessas das políticas viram critério de aceite (parcelamento sem juros configurado no Asaas,
  expiração automática do Pix, página do pedido com rastreio).
- [ ] **Fase 2 (acessibilidade):** link do WhatsApp com `target=_blank` sem aviso para leitor de tela;
  botão compacto do card mostra só 🛒.
- [ ] **Fase 3:** `productGroupJsonLd` (`hasVariant`) sem `offers`/`availability`; usar
  `hasSellablePrice` e `inStockFromQty` (de `@mypet/core/retail`) também no feed.

### Fase 2 — dependências externas (registradas em 2026-11-01)
- [ ] **Autorizar a migration** `20261101120000_retail_checkout` no `hub_catalogo` (Task 3 do plano da fase 2).
- [ ] **Sandbox do Asaas** (chave de API + token do webhook apontando para `/api/webhooks/asaas`) e **sandbox do Melhor Envio** (token `shipping-calculate`).
- [ ] **SMTP e e-mail da equipe** para os avisos de pedido pago.
- [ ] **Listmonk** (decisão do usuário: e-mail "pedido enviado" sai por ele): template transacional com as chaves
  `numero`, `nome`, `rastreio`, `transportadora`, `link_pedido`; usuário/token de API; env vars no admin
  (`LISTMONK_URL`, `LISTMONK_API_USER`, `LISTMONK_API_TOKEN`, `LISTMONK_TEMPLATE_PEDIDO_ENVIADO`, `AZPETSHOP_SITE_URL`);
  confirmar se a versão exige o cliente já cadastrado como subscriber para `/api/tx`.
- [ ] **Aviso de pedido pago por WhatsApp para a equipe**: fora da fase 2 (não há API de WhatsApp); só e-mail.
- [ ] **Parcelamento sem juros configurado no Asaas** (a política de pagamento promete).

### Após a fase 2 (registrado em 2026-11-01)
- [x] Migrations `20261101120000_retail_checkout` e `20261101130000_mark_order_paid` aplicadas no `hub_catalogo`.
- [ ] **Teste ponta a ponta em sandbox** (Task 13 do plano da fase 2): não feito, faltam credenciais.
- [ ] **Credenciais de produção** do Asaas e Melhor Envio, webhook de produção, `SITE_URL`, SMTP e Listmonk nos projetos Vercel (azpetshop e admin).
- [x] **Pedidos órfãos** quando o Asaas falha: o pedido agora é apagado (rollback).
- [ ] **Rastreio não reeditável** se a gravação falhar depois de o pedido virar `enviado`.
- [x] Timeouts nas chamadas ao Asaas, Melhor Envio e Listmonk (10 s).
- [ ] **Cuidado no teste em sandbox:** o preview usa o `hub_catalogo` de produção. Um pagamento de teste baixa o
  `stock_qty` real (compartilhado por todos os canais) e o pedido aparece no admin. Usar um produto exclusivo de teste
  e configurar `SITE_URL` do preview (sem ele, os links de retorno do pagamento vão para o site de produção).
- [ ] **Estornos e chargebacks** (`PAYMENT_REFUNDED` etc.) não são tratados pelo webhook.
- [ ] **Versão do Listmonk:** o envio usa `subscriber_mode: "external"` (Listmonk ≥ 5); versões antigas exigem o cliente cadastrado.
- [ ] Remover a função `decrement_order_stock` (sem uso) numa migration futura.

### Menores (quando conveniente)
- [ ] Ano do copyright fixo (`ANO_COPYRIGHT = 2026` em `app/site-footer.tsx`): atualizar a cada ano.
- [ ] Rodapé não fica preso ao fim da tela em páginas curtas.
- [ ] PDP: `inStock` calculado mesmo para produto com variações (sem efeito) e JSX sem reindentação.
