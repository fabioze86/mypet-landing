# Protótipo de home "quase infinita" com vitrine de marcas

**Data:** 2026-07-26
**Status:** Aprovado — pronto para plano de implementação

## Contexto e problema

Hoje as homes de `apps/mypet` e `apps/distribuidora` seguem um layout enxuto: hero +
estatísticas + um bloco único de catálogo paginado (`CatalogSection`), sem vitrine de
marcas, sem carrosséis temáticos, sem sensação de "catálogo quase infinito". O usuário
quer explorar um layout de home muito mais denso — inspirado em amazon.com.br
(carrosséis temáticos, densidade de produtos) e instacart.com (vitrine de marcas/
fornecedores em grade, "Your stores") — que destaque os números do negócio (8.000+
SKUs, 200+ marcas) e role de forma praticamente infinita.

O usuário explicitamente **não quer vincular esse layout a nenhum app real ainda**.
Quer primeiro validar visualmente o layout, e só depois (fora do escopo deste spec)
decidir em qual app implementá-lo com dados e componentes reais.

**Fora do escopo desta entrega:** qualquer integração com Supabase, `@mypet/core`
(`ProductCard`, `CatalogSection`, `getBrands`, etc.), ou com qualquer app do monorepo.
Sem filtros persistentes (sidebar ou barra de filtros) — decisão explícita do usuário:
a home fica focada em descoberta/vitrine, filtros continuam sendo responsabilidade das
páginas de categoria/busca existentes.

## Formato de entrega

Um único Artifact HTML autocontido (mockup navegável, publicado via ferramenta de
Artifact), com dados fictícios embutidos diretamente no HTML/JS (nomes de marca,
categorias, produtos, preços e imagens placeholder). Sem chamadas de rede reais, sem
dependência de build do monorepo. Usa a paleta de cores da marca MyPet (rosa/navy) já
presente em `packages/core/src/theme.tsx`, apenas como referência visual — não importa
o módulo em si, já que o artifact é isolado do código do projeto.

Este spec descreve o layout a construir; a implementação é o próprio arquivo HTML do
artifact (não há novo código no repositório além deste documento).

## Seções da home (ordem de cima para baixo)

1. **Header** — logo "MyPet" à esquerda, barra de busca central grande e proeminente
   (placeholder: "Buscar entre 8.000+ produtos, 200+ marcas"), ícones de conta/carrinho
   à direita. Abaixo do header, uma faixa fina e leve de links de categoria em linha
   (wrap simples, sem dropdown/mega menu) — só orientação, não é filtro.

2. **Hero** — banner de destaque (1 slide estático, com setas decorativas de carrossel
   não funcionais) anunciando uma campanha (ex.: "Festival de Inverno"). Logo abaixo,
   uma faixa de estatísticas do negócio — "8.000+ SKUs", "200+ marcas", "48h entrega
   média", "R$0 taxa de cadastro" — no mesmo espírito do `STATS_STATIC` que já existe em
   `apps/mypet/app/page.tsx`.

3. **Vitrine de marcas ("Nossas marcas")** — grade densa de 12–16 cards de marca
   (nome + cor de fundo distinta por card, sem depender de logos reais), inspirada na
   seção "Your stores" do Instacart. Alguns cards com badge (“Mais vendida”,
   “Exclusiva”, “Lançamento”). Último card da grade é "Ver todas as 200+ marcas →"
   (não navega para lugar nenhum no protótipo).

4. **Carrosséis temáticos** — 3 a 4 fileiras, cada uma com título + scroll horizontal
   de cards de produto (nome, marca, preço, badge opcional tipo "Oferta"). Temas
   sugeridos: "Mais vendidos da semana", "Ofertas imperdíveis", "Novidades no
   catálogo", "Marca em destaque". Setas de navegação lateral funcionais (scroll
   suave via JS), sem paginação.

5. **Grid infinito ("Explore todo o catálogo")** — grid denso (5–6 colunas em
   desktop, responsivo) de cards de produto. Ao rolar até o fim da grade, um
   `IntersectionObserver` dispara o carregamento de mais itens (gerados/duplicados a
   partir do conjunto mock, com pequenas variações de nome/preço) e mostra um spinner
   "carregando mais produtos...". Sem limite artificial baixo — deve sustentar a
   sensação de catálogo praticamente infinito por vários carregamentos.

6. **Rodapé** — simples, institucional, mesmo tom visual das demais seções (links
   fictícios, copyright).

## Interações do protótipo

- Scroll horizontal (mouse/touch/drag) dentro dos carrosséis, com setas de apoio.
- Scroll infinito no grid final via `IntersectionObserver`, sem chamadas de rede —
  tudo client-side com dados mock já embutidos no HTML.
- Hover states nos cards de marca e produto (leve elevação/sombra), consistente com o
  tom visual do design system existente (cantos arredondados, sombras suaves).
- Responsivo: carrosséis e grid se adaptam a telas estreitas (menos colunas, cards
  full-width em mobile para o hero/stats).

## Decisões e trade-offs

| Decisão | Motivo |
| --- | --- |
| Artifact HTML isolado, não uma rota em nenhum app | Pedido explícito do usuário: validar o layout antes de comprometer com um app específico |
| Dados 100% fictícios, sem Supabase/`@mypet/core` | Mantém o protótipo desacoplado; a integração real fica para uma etapa futura, depois da aprovação visual |
| Sem filtros/sidebar nesta home | Decisão explícita do usuário durante o brainstorming — home foca em descoberta, filtros ficam nas páginas de categoria/busca |
| Paleta MyPet como referência visual | Dá contexto realista ao mockup sem comprometer a decisão de "qual app" — é só uma referência de cor, fácil de trocar depois |
| Scroll infinito simulado com dados mock duplicados/variados | Suficiente para demonstrar a sensação "quase infinita" pedida, sem precisar de um dataset real de 8.000 produtos |

## Próximos passos

1. Revisão deste spec pelo usuário.
2. Plano de implementação (`writing-plans`): construir o arquivo HTML do artifact
   com as 6 seções acima, dados mock, interações de scroll e responsividade; publicar
   via ferramenta de Artifact para revisão visual.
3. Depois de aprovado visualmente: novo spec (fora deste escopo) para decidir em qual
   app implementar de fato, com dados e componentes reais do `@mypet/core`.
