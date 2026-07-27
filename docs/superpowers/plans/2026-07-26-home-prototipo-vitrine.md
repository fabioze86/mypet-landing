# Home Protótipo Vitrine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir e publicar um Artifact HTML autocontido de uma home "quase infinita", com vitrine de marcas, carrosséis temáticos e grid infinito, usando dados 100% fictícios e a paleta MyPet como referência visual — sem tocar em nenhum app do monorepo.

**Architecture:** Um único arquivo HTML (`scratchpad/home-prototipo.html`) com CSS inline (`<style>`) e JS inline (`<script>`), sem dependências externas. Dados mock (marcas, produtos) vivem como arrays JS no topo do `<script>`. O arquivo é publicado via ferramenta de Artifact ao final de cada task relevante para revisão visual incremental.

**Tech Stack:** HTML5, CSS3 (flexbox/grid, `@media` para responsividade e dark mode), JavaScript vanilla (`IntersectionObserver` para scroll infinito, scroll horizontal nativo com `scroll-snap`/setas).

## Global Constraints

- Sem dependências externas (CDN, fontes remotas, imagens remotas) — tudo inline, conforme regras de Artifact.
- Paleta de referência (de `packages/core/src/theme.tsx`, uso apenas visual): rosa `#EC1E63` / navy `#1A3472` / cinzas `#F5F6F8`(gray50) `#E4E7EC`(gray200) `#6B7280`(gray600).
- Sem filtros/sidebar persistente na home (decisão do spec).
- Sem chamadas de rede reais; scroll infinito usa apenas dados mock já embutidos.
- Responsivo: layout deve se adaptar a telas estreitas (~375px) sem scroll horizontal da página inteira.
- Favicon do artifact: 🛒 (mantido estável em todas as republicações).

---

### Task 1: Esqueleto do arquivo, dados mock e paleta

**Files:**
- Create: `C:\Users\MYPET~1\AppData\Local\Temp\claude\c--Projetos-mypet-landing\c4dce6f1-0f0b-4eee-b442-759cc5afbf77\scratchpad\home-prototipo.html`

**Interfaces:**
- Produces: variável global `MOCK_BRANDS: {name: string, color: string, badge?: string}[]` (16 itens) e `MOCK_PRODUCTS: {name: string, brand: string, price: string, badge?: string}[]` (gerador de 24 produtos base), disponíveis para as tasks seguintes via `<script>` no mesmo arquivo.
- Consumes: nada (task inicial).

- [ ] **Step 1: Criar o arquivo com `<title>`, reset CSS mínimo e variáveis de cor**

Conteúdo inicial (sem `<!doctype>`/`<html>`/`<head>`/`<body>`, conforme regra de Artifact):

```html
<title>MyPet — Home Vitrine (Protótipo)</title>
<style>
  :root {
    --pink: #EC1E63;
    --navy: #1A3472;
    --gray50: #F5F6F8;
    --gray200: #E4E7EC;
    --gray600: #6B7280;
    --white: #FFFFFF;
    --bg: var(--white);
    --fg: var(--navy);
    --card-bg: var(--white);
  }
  :root[data-theme="dark"] {
    --bg: #0F1420;
    --fg: #F5F6F8;
    --card-bg: #1A2233;
    --gray200: #2A3348;
    --gray50: #161D2B;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #0F1420;
      --fg: #F5F6F8;
      --card-bg: #1A2233;
      --gray200: #2A3348;
      --gray50: #161D2B;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg); font-family: -apple-system, "Segoe UI", Nunito, sans-serif; }
  img, svg { max-width: 100%; }
</style>
<div id="root"></div>
```

- [ ] **Step 2: Adicionar bloco `<script>` com os dados mock**

```html
<script>
  const MOCK_BRANDS = [
    { name: "PetLove", color: "#EC1E63", badge: "Mais vendida" },
    { name: "Golden", color: "#1A3472" },
    { name: "Royal Canin", color: "#0E7C4A" },
    { name: "Pedigree", color: "#B8860B" },
    { name: "Whiskas", color: "#7B3FA0" },
    { name: "N&D", color: "#C0392B" },
    { name: "Premier", color: "#2C7BA0", badge: "Exclusiva" },
    { name: "Special Dog", color: "#8E5B2D" },
    { name: "Guabi", color: "#3D8B37" },
    { name: "Hill's", color: "#264653" },
    { name: "Fórmula Natural", color: "#5B8C3A", badge: "Lançamento" },
    { name: "GranPlus", color: "#B5461A" },
    { name: "Farmina", color: "#1F6F5C" },
    { name: "ProPlan", color: "#0B4F8A" },
    { name: "Biofresh", color: "#6D8C1F" },
    { name: "Vet's Best", color: "#A0397A" },
  ];

  const PRODUCT_NOUNS = [
    "Ração Cães Adultos 15kg", "Ração Gatos Castrados 10kg", "Petisco Natural 200g",
    "Areia Higiênica 4kg", "Tapete Higiênico 30un", "Shampoo Neutro 500ml",
    "Brinquedo Mordedor", "Coleira Ajustável M", "Comedouro Duplo Inox",
    "Sachê Carne ao Molho 85g", "Ração Filhotes 3kg", "Antipulgas Transdermal",
  ];

  function makeProducts(count, offset = 0) {
    const items = [];
    for (let i = 0; i < count; i++) {
      const brand = MOCK_BRANDS[(i + offset) % MOCK_BRANDS.length];
      const noun = PRODUCT_NOUNS[(i + offset) % PRODUCT_NOUNS.length];
      const price = (29.9 + ((i + offset) * 7.3) % 220).toFixed(2).replace(".", ",");
      items.push({
        id: `p-${offset}-${i}`,
        name: `${noun} ${brand.name}`,
        brand: brand.name,
        price,
        badge: (i + offset) % 5 === 0 ? "Oferta" : null,
      });
    }
    return items;
  }

  const MOCK_PRODUCTS = makeProducts(24);
</script>
```

- [ ] **Step 3: Verificar no navegador que a página carrega sem erros**

Publicar via ferramenta de Artifact (favicon 🛒, description curta) e confirmar visualmente: fundo branco/dark conforme tema, sem erros no console (usar apenas inspeção visual, já que não há test runner para HTML solto).

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-07-26-home-prototipo-vitrine.md
git commit -m "docs: adiciona plano de implementacao do prototipo de home"
```

---

### Task 2: Header + faixa de categorias + Hero com estatísticas

**Files:**
- Modify: `home-prototipo.html` (mesmo arquivo da Task 1)

**Interfaces:**
- Consumes: variáveis CSS `--pink`, `--navy`, `--gray50`, `--gray200`, `--gray600` (Task 1).
- Produces: classes CSS `.header`, `.search-bar`, `.category-strip`, `.hero`, `.stats-bar` reutilizadas visualmente pelas próximas seções (mesmo `<style>` global).

- [ ] **Step 1: Adicionar HTML do header dentro de `#root`**

```html
<header class="header">
  <div class="header-inner">
    <div class="logo">🐾 MyPet</div>
    <input class="search-bar" type="text" placeholder="Buscar entre 8.000+ produtos, 200+ marcas" aria-label="Buscar produtos" />
    <div class="header-icons">
      <span title="Conta">👤</span>
      <span title="Carrinho">🛒</span>
    </div>
  </div>
  <nav class="category-strip" aria-label="Categorias">
    <a href="#">Cães</a><a href="#">Gatos</a><a href="#">Aves</a><a href="#">Peixes</a>
    <a href="#">Roedores</a><a href="#">Higiene</a><a href="#">Brinquedos</a>
    <a href="#">Farmácia</a><a href="#">Acessórios</a><a href="#">Camas</a>
  </nav>
</header>
```

- [ ] **Step 2: Adicionar HTML do hero + stats**

```html
<section class="hero">
  <div class="hero-banner">
    <span class="hero-arrow left">‹</span>
    <div class="hero-content">
      <h1>Festival de Inverno na MyPet Atacado</h1>
      <p>Milhares de produtos com condições especiais para o seu petshop</p>
    </div>
    <span class="hero-arrow right">›</span>
  </div>
  <div class="stats-bar">
    <div class="stat"><strong>8.000+</strong><span>SKUs no catálogo</span></div>
    <div class="stat"><strong>200+</strong><span>Marcas parceiras</span></div>
    <div class="stat"><strong>48h</strong><span>Entrega média SP</span></div>
    <div class="stat"><strong>R$0</strong><span>Taxa de cadastro</span></div>
  </div>
</section>
```

- [ ] **Step 3: Adicionar CSS correspondente ao `<style>` existente**

```css
.header { position: sticky; top: 0; z-index: 10; background: var(--bg); border-bottom: 1px solid var(--gray200); }
.header-inner { max-width: 1280px; margin: 0 auto; padding: 14px 24px; display: flex; align-items: center; gap: 20px; }
.logo { font-weight: 900; font-size: 20px; color: var(--pink); white-space: nowrap; }
.search-bar { flex: 1; padding: 12px 16px; border-radius: 10px; border: 1px solid var(--gray200); font-size: 14px; background: var(--card-bg); color: var(--fg); }
.header-icons { display: flex; gap: 16px; font-size: 20px; }
.category-strip { max-width: 1280px; margin: 0 auto; padding: 0 24px 12px; display: flex; flex-wrap: wrap; gap: 18px; }
.category-strip a { color: var(--gray600); text-decoration: none; font-size: 13px; font-weight: 700; }
.category-strip a:hover { color: var(--pink); }

.hero { max-width: 1280px; margin: 24px auto 0; padding: 0 24px; }
.hero-banner { position: relative; background: linear-gradient(135deg, var(--navy), var(--pink)); border-radius: 20px; padding: 48px 32px; color: white; display: flex; align-items: center; justify-content: center; text-align: center; min-height: 180px; }
.hero-content h1 { margin: 0 0 8px; font-size: 28px; }
.hero-content p { margin: 0; opacity: .9; }
.hero-arrow { position: absolute; top: 50%; transform: translateY(-50%); font-size: 28px; opacity: .7; cursor: pointer; }
.hero-arrow.left { left: 16px; } .hero-arrow.right { right: 16px; }
.stats-bar { display: grid; grid-template-columns: repeat(4, 1fr); margin-top: 20px; border: 1px solid var(--gray200); border-radius: 16px; overflow: hidden; }
.stat { padding: 20px; text-align: center; border-right: 1px solid var(--gray200); }
.stat:last-child { border-right: none; }
.stat strong { display: block; font-size: 24px; color: var(--pink); }
.stat span { font-size: 13px; color: var(--gray600); }
@media (max-width: 640px) {
  .header-inner { flex-wrap: wrap; }
  .search-bar { order: 3; flex-basis: 100%; }
  .stats-bar { grid-template-columns: repeat(2, 1fr); }
  .stat:nth-child(2) { border-right: none; }
}
```

- [ ] **Step 4: Republicar o artifact e verificar visualmente**

Header sticky, busca ocupando espaço central, faixa de categorias com wrap, hero com gradiente rosa/navy, stats em 4 colunas (2 em mobile simulado reduzindo a largura da janela).

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-07-26-home-prototipo-vitrine.md
git commit -m "docs: marca task 2 do plano de home prototipo como concluida" --allow-empty
```

---

### Task 3: Vitrine de marcas ("Nossas marcas")

**Files:**
- Modify: `home-prototipo.html`

**Interfaces:**
- Consumes: `MOCK_BRANDS` (Task 1), `.category-strip`/`.hero` (para posicionamento seguinte).
- Produces: função JS `renderBrands()` que popula `#brands-grid`; classe `.brand-card`.

- [ ] **Step 1: Adicionar HTML da seção (contêiner vazio, populado via JS)**

```html
<section class="section-brands">
  <h2>Nossas marcas</h2>
  <div id="brands-grid" class="brands-grid"></div>
</section>
```

- [ ] **Step 2: Adicionar CSS**

```css
.section-brands { max-width: 1280px; margin: 40px auto 0; padding: 0 24px; }
.section-brands h2 { font-size: 20px; margin-bottom: 16px; }
.brands-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 16px; }
.brand-card { position: relative; border-radius: 14px; padding: 24px 12px; text-align: center; color: white; font-weight: 800; cursor: pointer; transition: transform .15s ease; }
.brand-card:hover { transform: translateY(-3px); }
.brand-card .badge { position: absolute; top: 8px; right: 8px; background: rgba(255,255,255,.25); font-size: 10px; padding: 2px 8px; border-radius: 999px; font-weight: 700; }
.brand-card.see-all { background: var(--gray50); color: var(--fg); border: 1px dashed var(--gray200); display: flex; align-items: center; justify-content: center; }
```

- [ ] **Step 3: Adicionar JS de renderização**

```html
<script>
  function renderBrands() {
    const grid = document.getElementById("brands-grid");
    grid.innerHTML = MOCK_BRANDS.map(b => `
      <div class="brand-card" style="background:${b.color}">
        ${b.badge ? `<span class="badge">${b.badge}</span>` : ""}
        ${b.name}
      </div>
    `).join("") + `<div class="brand-card see-all">Ver todas as 200+ marcas →</div>`;
  }
  renderBrands();
</script>
```

- [ ] **Step 4: Republicar e verificar visualmente**

Grade de 16 cards coloridos + card "ver todas" ao final, badges visíveis nos cards que têm, hover levanta o card.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-07-26-home-prototipo-vitrine.md
git commit -m "docs: marca task 3 do plano de home prototipo como concluida" --allow-empty
```

---

### Task 4: Carrosséis temáticos de produtos

**Files:**
- Modify: `home-prototipo.html`

**Interfaces:**
- Consumes: `makeProducts(count, offset)` (Task 1).
- Produces: função `renderCarousel(containerId, products)`; classes `.carousel-row`, `.product-card-mini`.

- [ ] **Step 1: Adicionar HTML com 4 seções de carrossel (contêineres vazios)**

```html
<section class="section-carousels">
  <div class="carousel-block">
    <h2>Mais vendidos da semana</h2>
    <div class="carousel-wrap">
      <button class="carousel-arrow left" data-target="carousel-1">‹</button>
      <div id="carousel-1" class="carousel-row"></div>
      <button class="carousel-arrow right" data-target="carousel-1">›</button>
    </div>
  </div>
  <div class="carousel-block">
    <h2>Ofertas imperdíveis</h2>
    <div class="carousel-wrap">
      <button class="carousel-arrow left" data-target="carousel-2">‹</button>
      <div id="carousel-2" class="carousel-row"></div>
      <button class="carousel-arrow right" data-target="carousel-2">›</button>
    </div>
  </div>
  <div class="carousel-block">
    <h2>Novidades no catálogo</h2>
    <div class="carousel-wrap">
      <button class="carousel-arrow left" data-target="carousel-3">‹</button>
      <div id="carousel-3" class="carousel-row"></div>
      <button class="carousel-arrow right" data-target="carousel-3">›</button>
    </div>
  </div>
  <div class="carousel-block">
    <h2>Marca em destaque: PetLove</h2>
    <div class="carousel-wrap">
      <button class="carousel-arrow left" data-target="carousel-4">‹</button>
      <div id="carousel-4" class="carousel-row"></div>
      <button class="carousel-arrow right" data-target="carousel-4">›</button>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Adicionar CSS**

```css
.section-carousels { max-width: 1280px; margin: 40px auto 0; padding: 0 24px; }
.carousel-block { margin-bottom: 32px; }
.carousel-block h2 { font-size: 20px; margin-bottom: 16px; }
.carousel-wrap { position: relative; }
.carousel-row { display: flex; gap: 16px; overflow-x: auto; scroll-behavior: smooth; scroll-snap-type: x proximity; padding-bottom: 8px; }
.carousel-row::-webkit-scrollbar { height: 6px; }
.product-card-mini { scroll-snap-align: start; flex: 0 0 180px; background: var(--card-bg); border: 1px solid var(--gray200); border-radius: 14px; padding: 14px; cursor: pointer; transition: box-shadow .15s ease; }
.product-card-mini:hover { box-shadow: 0 8px 20px rgba(0,0,0,.08); }
.product-card-mini .thumb { height: 100px; border-radius: 10px; background: var(--gray50); margin-bottom: 10px; display: flex; align-items: center; justify-content: center; font-size: 28px; }
.product-card-mini .name { font-size: 13px; font-weight: 700; margin-bottom: 4px; min-height: 34px; }
.product-card-mini .brand { font-size: 11px; color: var(--gray600); margin-bottom: 6px; }
.product-card-mini .price { font-size: 15px; font-weight: 900; color: var(--pink); }
.product-card-mini .badge { display: inline-block; background: var(--pink); color: white; font-size: 10px; padding: 2px 8px; border-radius: 999px; margin-bottom: 6px; }
.carousel-arrow { position: absolute; top: 50%; transform: translateY(-50%); z-index: 2; border: none; background: var(--card-bg); box-shadow: 0 2px 8px rgba(0,0,0,.15); width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 18px; }
.carousel-arrow.left { left: -12px; } .carousel-arrow.right { right: -12px; }
```

- [ ] **Step 3: Adicionar JS de renderização e scroll das setas**

```html
<script>
  function productCardHtml(p) {
    return `
      <div class="product-card-mini">
        <div class="thumb">🐾</div>
        ${p.badge ? `<span class="badge">${p.badge}</span>` : ""}
        <div class="name">${p.name}</div>
        <div class="brand">${p.brand}</div>
        <div class="price">R$ ${p.price}</div>
      </div>
    `;
  }

  function renderCarousel(containerId, products) {
    document.getElementById(containerId).innerHTML = products.map(productCardHtml).join("");
  }

  renderCarousel("carousel-1", makeProducts(10, 0));
  renderCarousel("carousel-2", makeProducts(10, 40));
  renderCarousel("carousel-3", makeProducts(10, 80));
  renderCarousel("carousel-4", makeProducts(10, 120).map(p => ({ ...p, brand: "PetLove" })));

  document.querySelectorAll(".carousel-arrow").forEach(btn => {
    btn.addEventListener("click", () => {
      const row = document.getElementById(btn.dataset.target);
      const dir = btn.classList.contains("left") ? -1 : 1;
      row.scrollBy({ left: dir * 360, behavior: "smooth" });
    });
  });
</script>
```

- [ ] **Step 4: Republicar e verificar visualmente**

4 fileiras de carrossel, scroll horizontal com drag e com as setas, cards com hover, badge "Oferta" aparecendo em alguns.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-07-26-home-prototipo-vitrine.md
git commit -m "docs: marca task 4 do plano de home prototipo como concluida" --allow-empty
```

---

### Task 5: Grid infinito de produtos

**Files:**
- Modify: `home-prototipo.html`

**Interfaces:**
- Consumes: `makeProducts(count, offset)` (Task 1), `productCardHtml(p)` (Task 4, reaproveitada em layout de grid via classe `.product-card-mini` já existente).
- Produces: nada consumido por tasks futuras (última seção de conteúdo).

- [ ] **Step 1: Adicionar HTML da seção com sentinela de scroll**

```html
<section class="section-infinite">
  <h2>Explore todo o catálogo</h2>
  <div id="infinite-grid" class="infinite-grid"></div>
  <div id="infinite-sentinel" class="infinite-sentinel">Carregando mais produtos...</div>
</section>
```

- [ ] **Step 2: Adicionar CSS**

```css
.section-infinite { max-width: 1280px; margin: 40px auto 0; padding: 0 24px; }
.section-infinite h2 { font-size: 20px; margin-bottom: 16px; }
.infinite-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }
.infinite-grid .product-card-mini { flex: none; }
.infinite-sentinel { text-align: center; padding: 24px; color: var(--gray600); font-size: 13px; }
```

- [ ] **Step 3: Adicionar JS de carregamento incremental via `IntersectionObserver`**

```html
<script>
  let infiniteOffset = 200;
  const infiniteGrid = document.getElementById("infinite-grid");

  function loadMoreProducts() {
    const batch = makeProducts(18, infiniteOffset);
    infiniteOffset += 18;
    infiniteGrid.insertAdjacentHTML("beforeend", batch.map(productCardHtml).join(""));
  }

  loadMoreProducts();
  loadMoreProducts();

  const sentinel = document.getElementById("infinite-sentinel");
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      loadMoreProducts();
    }
  }, { rootMargin: "400px" });
  observer.observe(sentinel);
</script>
```

- [ ] **Step 4: Republicar e verificar visualmente**

Rolar até o fim da página várias vezes seguidas e confirmar que novos cards continuam aparecendo (pelo menos 5-6 carregamentos consecutivos) sem travar a página nem duplicar o sentinela.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-07-26-home-prototipo-vitrine.md
git commit -m "docs: marca task 5 do plano de home prototipo como concluida" --allow-empty
```

---

### Task 6: Rodapé e publicação final

**Files:**
- Modify: `home-prototipo.html`

**Interfaces:**
- Consumes: todas as classes/seções anteriores (task de fechamento).
- Produces: artifact publicado com URL final para revisão do usuário.

- [ ] **Step 1: Adicionar HTML do rodapé**

```html
<footer class="footer">
  <div class="footer-inner">
    <span>© 2026 MyPet Atacado — Protótipo de layout, dados fictícios</span>
    <div class="footer-links">
      <a href="#">Sobre</a><a href="#">Contato</a><a href="#">Termos</a>
    </div>
  </div>
</footer>
```

- [ ] **Step 2: Adicionar CSS**

```css
.footer { margin-top: 48px; border-top: 1px solid var(--gray200); padding: 24px; }
.footer-inner { max-width: 1280px; margin: 0 auto; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; color: var(--gray600); font-size: 13px; }
.footer-links { display: flex; gap: 16px; }
.footer-links a { color: var(--gray600); text-decoration: none; }
```

- [ ] **Step 3: Revisão final de responsividade**

Conferir em três larguras simuladas (≈1280px, ≈768px, ≈375px): nenhuma seção deve causar scroll horizontal da página inteira; carrosséis e tabelas usam `overflow-x` no próprio contêiner, nunca no `body`.

- [ ] **Step 4: Publicar o artifact final**

Usar a ferramenta de Artifact com `file_path` apontando para `home-prototipo.html`, `title: "MyPet — Home Vitrine (Protótipo)"`, `favicon: "🛒"`, `description` curta explicando que é um mockup de layout com dados fictícios.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-07-26-home-prototipo-vitrine.md
git commit -m "docs: marca plano de home prototipo como concluido" --allow-empty
```

## Decisões e trade-offs

| Decisão | Motivo |
| --- | --- |
| Um único arquivo HTML em vez de múltiplos arquivos/módulos | Artifacts publicam um arquivo só; o "file structure" da spec de plano não se aplica da mesma forma que num app real |
| "Testes" viram verificação visual manual a cada task | Não há test runner para HTML solto fora do monorepo; a evidência de correção é a própria renderização no Artifact |
| Reaproveitar `.product-card-mini` tanto nos carrosséis quanto no grid infinito | Evita duplicar CSS/HTML de card; grid e carrossel só diferem no contêiner pai (`flex` vs `grid`) |
| Emoji como thumbnail de produto (sem imagens) | Sem acesso a imagens reais de produto nesta etapa; mantém o artifact 100% autocontido |

## Próximos passos

1. Executar as 6 tasks acima, publicando o artifact incrementalmente para revisão visual.
2. Após aprovação do usuário: novo spec para portar o layout escolhido a um app real do monorepo, substituindo dados mock por `getBrands`/`getCatalog`/`ProductCard` reais.
