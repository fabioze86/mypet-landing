# AZ Pet Shop (MAD PET) — Landing Page

Data: 2026-07-25

## Contexto

Nova landing page de sub-marca do Grupo AZ (My Pet Brasil): **MAD PET**, linha própria de
fabricação (bandanas, laços, peitorais, coleiras). Sem checkout próprio — todo CTA de compra
direciona para WhatsApp (mensagem pré-preenchida com o nome do produto) ou para os canais de
venda vigentes (loja própria / marketplace / Distribuidora).

O app final se chama `azpetshop` (não `madpet`) — nome do app, do canal Supabase e da pasta no
monorepo. "MAD PET" continua sendo o nome de marca exibido na UI (logo, headline, copy).

## Decisões já validadas com o usuário

- Novo app dentro do monorepo existente (`apps/azpetshop`), não repositório separado.
- Paleta de cores é isolada no app (`client-theme.ts` local), **não** estende o tipo `Palette`
  compartilhado de `@mypet/core/theme` — a identidade visual é deliberadamente diferente
  (sub-marca jovem, sem o sistema B2B de lead-gate/preço trancado).
- Produtos MAD PET **serão** sincronizados no Hub Catálogo (Supabase, projeto `hub_catalogo`),
  vinculados ao canal `"azpetshop"` — igual ao padrão dos outros apps (`mypetbrasil`,
  `distribuidora`). Não é mock local.
- Hoje (2026-07-25) não existe nenhum produto com esse canal cadastrado ainda — a UI precisa
  lidar bem com vitrines vazias até o time popular via admin/hub.

## Mapeamento de categorias (confirmado via SQL no projeto `hub_catalogo`)

As 4 linhas de produto do pedido já existem na taxonomia de categorias compartilhada:

| Linha      | category slug                                | category id (uuid)                   |
|------------|-----------------------------------------------|----------------------------------------|
| Bandanas   | `caes-moda-e-conforto-bandanas`               | `6044f664-4c8b-58d6-9de3-a9114ea50819` |
| Laços      | `caes-moda-e-conforto-lacos-e-gravatas`       | `af0d7456-9a3b-52e0-a406-a9b3c3e268fd` |
| Peitorais  | `guias-coleiras-e-peitorais-peitorais`        | `cb601178-eeb2-53ff-8361-d9f673259e8d` |
| Coleiras   | `guias-coleiras-e-peitorais-coleiras`         | `595fe241-fa35-5da6-8592-e49569d82a11` |

Cada vitrine filtra por `categoryId` (um dos ids acima) + `channel: "azpetshop"` + `brand: "MAD PET"`
usando `queryCatalog`/`getCatalog` de `@mypet/core/catalog` (já suportam os três filtros).
Isso distingue produtos MAD PET de outras marcas na mesma categoria.

## O que é reaproveitado de `@mypet/core` vs. o que é próprio do app

**Reaproveitado:**
- `catalog.ts`: `getCatalog`, `getCategories`, `getProductById` — mesma fonte de dados dos
  outros apps, sem duplicar lógica de paginação/mapeamento.
- `whatsapp.ts`: `buildWhatsAppLink(phoneNumber, message)` é genérico o bastante para reusar.
  Adiciona-se uma função nova e pequena, `buildProductInterestMessage(productName: string)`,
  que gera uma mensagem simples ("Olá! Tenho interesse no produto: {nome}") — não usa
  `buildQuoteMessage` (que é orientado a carrinho/cotação B2B).
- `channels.ts`: adiciona `"azpetshop"` à union `CHANNELS`.
- `catalog-utils.ts`: tipos `CatalogProduct`, helpers de mapeamento de imagem — reaproveitados
  como estão.

**Próprio do app (`apps/azpetshop`):**
- Paleta/tema (`client-theme.ts`) — verde/roxo, não estende `Palette` do core.
- `ProductCard` — versão simplificada própria: foto grande, nome, preço (se houver), botão
  "Quero esse" que abre WhatsApp. Sem badge de urgência/estoque, sem lead-gate, sem carrinho.
- Todos os componentes visuais da identidade MAD PET: divisor de onda (SVG reutilizável),
  mascote gato em line art (SVG próprio, criado do zero — não há asset real disponível ainda),
  hero, bloco de marca, seções por linha de produto, "onde comprar", bloco de SEO, FAQ com
  JSON-LD, footer, botão flutuante de WhatsApp.

## Paleta de cores (a confirmar hex exato depois com manual de marca)

Usando os valores aproximados do pedido original como ponto de partida:
- Verde principal: `#7AC142` (kelly/limão vibrante)
- Roxo principal: `#6B2D8C` (médio-escuro)
- Branco: `#FFFFFF` (contraste, textos, mascote)
- Tons derivados (hover/gradiente) calculados a partir desses dois — a definir na implementação.

## Tipografia

Google Font mais pesada/brincalhona que o resto do grupo (que usa Nunito): **Baloo 2** ou
**Fredoka** para o logo/headlines; Nunito para textos de corpo, mantendo alguma consistência
com o resto do Grupo AZ.

## Estrutura de pastas

```
apps/azpetshop/
  app/
    layout.tsx          # fonte, metadata SEO (title/description por linha de produto)
    page.tsx            # single-page com seções via âncoras
    globals.css
  components/
    wave-divider.tsx    # SVG reutilizável (prop de cor/flip) — elemento assinatura da marca
    mascot-cat.tsx       # SVG line art do gato, decorativo
    header-nav.tsx        # logo + âncoras + WhatsApp + link discreto pro site principal
    hero.tsx
    brand-block.tsx        # 2-3 frases sobre a MAD PET
    line-section.tsx       # banner + vitrine (client component p/ carrossel scroll-snap)
    product-card.tsx        # próprio, CTA "Quero esse" -> WhatsApp
    where-to-buy.tsx          # canais: loja própria / WhatsApp / marketplace
    seo-block.tsx               # H1 + H2s por linha, texto natural com termos de busca
    faq.tsx                       # H2 + resposta + JSON-LD FAQPage
    footer.tsx
    whatsapp-float-button.tsx      # botão flutuante fixo
  client-theme.ts    # paleta local (verde/roxo)
  client.config.ts     # nome, whatsapp number, domain, catalogChannel: "azpetshop"
  package.json
  next.config.ts
  tsconfig.json
  postcss.config.mjs
  public/
    mascote-gato.svg (ou gerado inline como componente)
```

## Seções da página (ordem final)

1. Header: logo MAD PET, âncoras (Bandanas/Laços/Peitorais/Coleiras/Onde Comprar), ícone
   WhatsApp, link discreto de volta pro site principal.
2. Hero: fundo diagonal verde/roxo com divisor de onda, mascote decorativo, headline curta,
   1 CTA.
3. Bloco de marca: 2-3 frases curtas.
4. 4x (banner + vitrine): Bandanas, Laços, Peitorais, Coleiras — vitrine em carrossel com
   scroll-snap no mobile, cards com foto grande + nome + preço opcional + "Quero esse".
   Quando a categoria não tiver produtos ainda, mostra estado "em breve" ao invés de vitrine
   vazia quebrada.
5. Onde encontrar / como comprar: canais com CTAs específicos.
6. Bloco de SEO: H1 + intro, H2 por linha com 2 parágrafos cada, links âncora internos.
7. FAQ: JSON-LD `FAQPage` — tamanhos, materiais, lavagem/cuidado, revenda/atacado, prazo de
   entrega.
8. Footer: contato, redes sociais, links para os outros sites do grupo, CNPJ/institucional
   mínimo.

## Requisitos técnicos

- Server Components para conteúdo estático/SEO; carrossel de vitrine (`line-section.tsx`) como
  Client Component (`"use client"`), scroll-snap nativo (sem lib extra).
- `next/image` em todas as fotos de produto vindas do Hub Catálogo.
- Mobile-first.
- Botão flutuante de WhatsApp fixo em toda a página.
- Metadados: title/description focados em "MAD PET acessórios pet" + nome de cada linha.
- Número de WhatsApp via `NEXT_PUBLIC_WHATSAPP_NUMBER` (mesmo padrão de env var dos outros
  apps) — assumindo o mesmo número usado pela distribuidora até informarem um número próprio
  da MAD PET.

## Fora de escopo (explicitamente, para não confundir com o padrão B2B existente)

- Sem carrinho (`CartProvider`), sem lead-gate/preço trancado (`UnlockButton`), sem fluxo de
  cotação — são padrões do B2B (distribuidora/mypet) que não fazem sentido pro CTA direto de
  WhatsApp da MAD PET.
- Sem criação de tabela nova no Supabase — reaproveita `products` + `product_channel_links`
  + `categories` existentes, apenas com um novo valor de `channel`.

## Observação de segurança (não relacionada ao escopo funcional)

Durante a exploração, um comando de shell imprimiu o conteúdo completo de
`apps/distribuidora/.env.local`, incluindo chaves de API e uma service account key do Google,
no histórico desta sessão. Recomenda-se ao usuário avaliar rotação dessas credenciais por
precaução. Isso não afeta o design do app novo.
